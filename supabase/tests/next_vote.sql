-- Assertions over next_votes: the two options are the queue's first two, one vote per
-- player, and the option with more votes takes the first slot.
--
-- Run with `pnpm db:test`, which resets the local database first.

do $$
declare
  v_a uuid;
  v_b uuid;
  v_first  uuid;
  v_second uuid;
  v_third  uuid;
  v_past   uuid;
begin
  select id into v_a from profiles order by id limit 1;
  select id into v_b from profiles order by id offset 1 limit 1;
  delete from challenge_sessions where opens_at > now();

  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);

  -- ── One queued session is not a choice ──────────────────────────────────────
  insert into challenge_sessions (mode_id, opens_at, closes_at, created_at)
  values ('challenge/one', now() + interval '1 day', now() + interval '2 days', now() - interval '3 hours')
  returning id into v_first;
  assert (select count(*) from next_vote_options()) = 0, 'one session should offer no vote';

  insert into challenge_sessions (mode_id, opens_at, closes_at, created_at)
  values ('challenge/two', now() + interval '3 days', now() + interval '4 days', now() - interval '2 hours')
  returning id into v_second;
  insert into challenge_sessions (mode_id, opens_at, closes_at, created_at)
  values ('challenge/three', now() + interval '5 days', now() + interval '6 days', now() - interval '1 hours')
  returning id into v_third;
  assert (select count(*) from next_vote_options()) = 2, 'the first two should be offered';

  -- ── Only players of the last challenge ──────────────────────────────────────
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/past', now() - interval '2 days', now() - interval '1 day')
  returning id into v_past;
  assert not (select can_vote from next_vote_options() limit 1), 'a non-player may not vote';
  begin
    perform vote_next(v_first);
    assert false, 'a player who skipped the last challenge should be refused';
  exception when others then
    assert sqlerrm like '%only players%', 'wrong error: ' || sqlerrm;
  end;
  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  values (v_past, v_a, 10, 1, 'easy', now() - interval '2 days'),
         (v_past, v_b, 10, 1, 'easy', now() - interval '2 days');
  assert (select can_vote from next_vote_options() limit 1), 'a player may vote';

  -- ── Only the two on offer ───────────────────────────────────────────────────
  begin
    perform vote_next(v_third);
    assert false, 'the third in the queue should not take a vote';
  exception when others then
    assert sqlerrm like '%not up for a vote%', 'wrong error: ' || sqlerrm;
  end;

  -- ── One vote each, and the latest wins ──────────────────────────────────────
  perform vote_next(v_first);
  perform vote_next(v_second);
  assert (select count(*) from next_votes) = 1, 'a second vote should move the first';
  assert (select mine from next_vote_options() where session_id = v_second), 'vote should be mine';

  -- ── The leader takes the first slot ─────────────────────────────────────────
  assert (select session_id from next_vote_options() order by session_id = v_second desc limit 1) = v_second;
  assert (select opens_at from challenge_sessions where id = v_second)
       < (select opens_at from challenge_sessions where id = v_first),
    'the option with more votes should open first';

  -- ── A tie goes back to the earlier booking ──────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform vote_next(v_first);
  assert (select opens_at from challenge_sessions where id = v_first)
       < (select opens_at from challenge_sessions where id = v_second),
    'a tie should keep the earlier booking first';
end;
$$;
