export const en = {
  tagline: 'The quiz show of the century',
  chooseLanguage: 'Choose a language to start',
  joinAt: 'Join at',
  roomCode: 'Room code',
  waitingForPlayers: 'Waiting for contestants…',
  playersCount: (n: number, max: number) => `${n}/${max} contestants`,
  needMorePlayers: (n: number) => `Need ${n} more to start`,
  vip: 'VIP',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  // phone
  enterCode: 'Room code',
  enterName: 'Your name',
  join: 'Join',
  youreIn: "You're in!",
  lookAtTv: 'Look at the TV',
  vipHint: "You're the VIP — you'll start the show.",
  waitForVip: 'The VIP will start the show.',
  roomClosed: 'This room has closed.',
  playAgainHint: 'Ask the host for a new code.',
  errors: {
    BAD_REQUEST: 'That didn’t look right. Check the code and name.',
    NOT_FOUND: 'No room with that code.',
    ROOM_FULL: 'This room is full.',
    NAME_TAKEN: 'Someone already has that name.',
    IN_PROGRESS: 'That game has already started.',
  },
};

export type Strings = typeof en;
