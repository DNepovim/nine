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
  | 'menu.profile'
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
  | 'tutorial_offer.accept'
  | 'tutorial_offer.dismiss'

  // ── The step-up ladder ──
  // Two doors onto it and one screen behind them: the toast a practice run floats, and
  // the dialog the tutorial ends on.
  | 'step_up_toast.accept'
  | 'step_up_toast.dismiss'
  | 'tutorial_done.accept'
  | 'tutorial_done.dismiss'
  | 'step_up.start'
  | 'step_up.other_mode'

  // ── Options ──
  | 'options.toggle'
  | 'options.theme_toggle'
  | 'options.locale_toggle'
  | 'options.dial_hint'
  | 'options.whats_new'
  | 'trainee_options.corner'
  | 'trainee_options.switch'

  // ── How to play ──
  | 'how_to_play.page'
  | 'how_to_play.try_it'

  // ── News ──
  | 'news.action'
  | 'news.dismiss'
  | 'news.done'
  // The launch popup's own button while it is on the winnings page: the press that turns
  // what the player is owed into fortune. Reported separately from `news.dismiss`, which
  // is the same button doing the other thing — a reward accepted and a dialog advanced
  // are not one funnel.
  | 'news.accept'

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
  | 'profile.add_nickname'
  | 'profile.edit_nickname'
  | 'profile.publish_scores'
  | 'profile.try_again'
  | 'profile.show_more'
  | 'nickname.save'
  | 'nickname.skip'
  | 'motto.save'
  | 'motto.cancel'
  | 'compare.name'
  | 'compare.try_again'
  | 'compare.close'

  // ── The address, and the profile it brings back ──
  | 'email.send'
  | 'email.cancel'
  | 'email_code.confirm'
  | 'email_code.resend'
  | 'email_code.edit_address'
  | 'email_code.paste'
  | 'email_code.clear'
  | 'email_code.cancel'
  | 'profile.add_email'
  | 'profile.edit_email'
  | 'profile.confirm_email'
  | 'profile.restore'
  | 'menu.confirm_email'
  | 'menu.profile_moved'

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

  // ── Challenges, as a player meets them ──
  // The card on the start screen, and the dialog behind it. `challenge.board` is the
  // standings inside that dialog — tracked because a player who opens the card and then
  // reads the board rather than pressing START is telling us something about the card.
  | 'menu.challenge'
  | 'challenge.start'
  | 'challenge.dismiss'
  | 'challenge.board'

  // ── Dev and admin ──
  | 'dev.run'
  | 'dev.done'
  | 'admin.tab'
  | 'admin.find'
  | 'admin.person'
  | 'admin.person_feature'
  | 'admin.person_reset'
  | 'admin.role'
  | 'admin.role_new'
  | 'admin.role_feature'
  | 'admin.role_preview'
  // A row on the FEATURES list, which opens that feature's screen, and the two presses
  // of the visibility picker on it: choosing an answer, and committing it. The press that
  // matters is the last one — a reader who chose and left is a reader who thought better
  // of it, and that is worth being able to see.
  | 'admin.feature'
  | 'admin.visibility_option'
  | 'admin.visibility_confirm'
  // The hub's three buttons, and the planner behind the second of them. `admin.section`
  // is every hub button and `admin.session_when` both date-time fields: the breakdown
  // is by screen, and a second id per pair would split one affordance in the funnel for
  // a question nobody is asking.
  | 'admin.section'
  | 'admin.session'
  | 'admin.session_new'
  | 'admin.session_save'
  | 'admin.session_cancel'
  | 'admin.session_challenge'
  | 'admin.session_when'
  // The two acts a live window allows, and the confirmations in front of them. Separate
  // from `admin.session_cancel`, which deletes a booking: closing early settles the
  // standings of a session that is running, and the two sit one above the other on the
  // same form.
  | 'admin.session_close_early'
  | 'admin.session_close_confirm'
  | 'admin.session_extend'
  | 'admin.session_extend_confirm'
  // The cog on the planner's title row, and the save inside the window behind it.
  // The two halves of a combobox, wherever one is drawn: the closed control that opens
  // the list, and a row inside it. One pair for all of them — the role on a person, the
  // window the figures are read over — because what is being reported is *a choice was
  // made with the combobox*, and which combobox is the screen already in the breakdown.
  | 'admin.select'
  | 'admin.select_option'
  // The filter above a list: which statuses of session, which state of message.
  | 'admin.filter'
  // A row of the messages list, opened to read the whole of what was written.
  | 'admin.message'
  // The two things that can be done about a message, and the press inside the dialog
  // that sends. `admin.message_open_answer` only opens the window — it is the one of the
  // three that writes nothing, and keeping them apart is what makes the figures read as
  // *answers opened* against *answers sent*.
  | 'admin.message_open_answer'
  | 'admin.message_answer'
  // Setting one aside and putting it back, which is one button saying two things — the
  // row's own state says which, and a single id keeps the pair counted as the one
  // decision it is.
  | 'admin.message_dismiss'
  // Adding a role, which is a dialog now rather than a field above the list: this is the
  // button that opens it, and `admin.role_new` above is the press inside it that creates
  // the role — which is what that id always reported.
  | 'admin.role_add'
  | 'admin.back'
  | 'admin.done'

  // ── Shared chrome, on whatever screen it is drawn ──
  | 'shared.page_dot'
  | 'shared.dialog_close'
  // The badge that ends a role preview. Here rather than under admin: it is drawn over
  // whichever screen the preview is being looked at, and the screen it is pressed on is
  // never the one it was started from.
  | 'shared.preview_exit'
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
