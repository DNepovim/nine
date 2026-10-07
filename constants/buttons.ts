// Every button the app reports a press of, spelled once.
//
// The same discipline `lib/analytics-events.ts` keeps for event names, kept here for the
// one event whose meaning lives entirely in a property: `button_pressed` would otherwise
// be a single funnel with ninety-odd spellings in it, and `pause.end_run` next to
// `pause_end_run` is two answers to one question with no way to notice.
//
// The id is `<screen>.<what it does>`, and the screen half is not decoration — it is
// read back out by `screenOf` so PostHog gets a breakdown dimension without anyone
// writing a string split in HogQL. Screen names follow the domain language in CLAUDE.md
// (intro is `menu` here only because that is what the machine state is called).
//
// Deliberately absent: the nine dial keys. They are not Pressables at all — the dial is
// one `GestureDetector` running a pan — and the aggregate a per-key event would produce
// already rides on `run_finished` and `run_ended`. See docs/analytics.md.
export type ButtonId =
  // ── Intro ──
  | 'menu.play'
  | 'menu.mode'
  | 'menu.board'
  | 'menu.difficulty'
  | 'menu.play_mode'
  | 'menu.options'
  | 'menu.how_to_play'
  | 'menu.create_room'
  | 'menu.join_room'
  | 'menu.dev'
  | 'menu.admin'

  // ── Game screen ──
  | 'game.pause'
  | 'game.menu'
  | 'game.compass_toggle'
  | 'best_scores.line'
  | 'best_scores.cell'

  // ── Pause and game over ──
  | 'game_over.home'
  | 'run_screen.cta'
  | 'run_screen.secondary'
  | 'run_screen.tertiary'
  | 'title.press'
  | 'title.secondary'

  // ── Tutorial ──
  | 'tutorial.tap_through'
  | 'tutorial.step'
  | 'tutorial.step_dot'
  | 'tutorial.curtain_lift'

  // ── The step-up ladder ──
  | 'step_up_toast.accept'
  | 'step_up_toast.dismiss'
  | 'step_up.start'
  | 'step_up.other_mode'

  // ── Options ──
  | 'options.toggle'
  | 'options.theme_toggle'
  | 'options.locale_toggle'
  | 'options.dial_hint'
  | 'options.whats_new'
  | 'options.done'
  | 'trainee_options.corner'
  | 'trainee_options.switch'

  // ── How to play ──
  | 'how_to_play.page'
  | 'how_to_play.try_it'
  | 'how_to_play.got_it'

  // ── News ──
  | 'news.action'
  | 'news.dismiss'
  | 'news.done'

  // ── Achievements and medals ──
  | 'achievements.earned'
  | 'achievements.progress_row'
  | 'achievement_detail.close'
  | 'achievement_detail.close_backdrop'
  | 'medals.line'
  | 'medals.show_more'
  | 'high_scores.row'
  | 'high_scores.score_row'

  // ── Profile ──
  | 'profile.action'
  | 'profile.add_motto'
  | 'profile.edit_motto'
  | 'profile.publish_scores'
  | 'profile.try_again'
  | 'profile.close'
  | 'nickname.save'
  | 'nickname.skip'
  | 'motto.save'
  | 'motto.cancel'
  | 'compare.name'
  | 'compare.try_again'
  | 'compare.close'

  // ── Multiplayer ──
  | 'join_room.join'
  | 'join_room.cancel'
  | 'join_room.key'
  | 'waiting_room.start'
  | 'waiting_room.copy_code'
  | 'waiting_room.share'
  | 'waiting_room.cancel'
  | 'waiting_room.player_tile'
  | 'multiplayer_game.menu'
  | 'multiplayer_menu.continue'
  | 'multiplayer_menu.leave'
  | 'multiplayer_results.start_next'
  | 'multiplayer_results.ready'
  | 'multiplayer_results.leave'

  // ── Arcade ──
  | 'arcade.retreat'
  | 'arcade_paused.end_run'
  | 'arcade_over.home'

  // ── Feedback ──
  | 'feedback.send'
  | 'feedback.close'
  | 'feedback_reply.got_it'

  // ── Install ──
  | 'install.action'

  // ── Replay consent ──
  | 'replay_consent.allow'
  | 'replay_consent.decline'

  // ── Dev and admin ──
  | 'dev.run'
  | 'dev.done'
  | 'admin.tab'
  | 'admin.find'
  | 'admin.person'
  | 'admin.person_role'
  | 'admin.person_feature'
  | 'admin.person_reset'
  | 'admin.role'
  | 'admin.role_new'
  | 'admin.role_delete'
  | 'admin.role_feature'
  | 'admin.feature_active'
  | 'admin.back'
  | 'admin.done'

  // ── Shared chrome, on whatever screen it is drawn ──
  | 'shared.page_dot'
  | 'crash.try_again'

// The screen half of an id, as a type rather than a second list to keep in step.
type ScreenOf<Id extends string> = Id extends `${infer Screen}.${string}` ? Screen : never

export type ButtonScreen = ScreenOf<ButtonId>

// Read back off the id, so no call site has to say the screen twice and the two halves
// cannot disagree. Every id in the list above has exactly one dot, which the type above
// is what guarantees — a new id without one would not be a `ButtonId`.
export function screenOf(id: ButtonId): ButtonScreen {
  return id.slice(0, id.indexOf('.')) as ButtonScreen
}
