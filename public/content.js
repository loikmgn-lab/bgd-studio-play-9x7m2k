// All authored content and tuning live here. No personal biographies are invented.
export const SETTINGS = {
  title: 'Обычный день Альберта', titleLines: ['ОБЫЧНЫЙ ДЕНЬ', 'АЛЬБЕРТА'], sessionSeconds: 180,
  firstEventAt: 7, firstSadAt: 21, eventInterval: 34, minimumInterval: 22,
  maxEvents: 3, repairSeconds: 3, secretSeconds: 7, happySeconds: 10,
  walkSpeed: 182, runMultiplier: 1.52, followerSpeed: 248,
  interactionRadius: 83, initialMood: 76, decayPerProblem: 0.22,
};
export const WORLD = {
  width: 1536, height: 1024,
  spawn: { x: 1100, y: 905 },
  // Only the visible studio exists. There is no secret-room map or camera target.
  curtain: { x: 195, y: 747, exit: { x: 214, y: 753 } },
  platform: { x: 373, y: 600, w: 478, h: 326, elevation: 9 },
  floor: [{x:112,y:130},{x:1390,y:130},{x:1430,y:925},{x:1148,y:925},{x:1140,y:976},{x:1064,y:976},{x:1054,y:925},{x:102,y:925}],
  obstacles: [
    { id: 'corner-back', x: 137, y: 131, w: 337, h: 110 },
    { id: 'corner-return', x: 130, y: 223, w: 140, h: 140 },
    { id: 'table', x: 313, y: 269, w: 123, h: 94 },
    { id: 'console', x: 510, y: 119, w: 173, h: 111 },
    { id: 'synth', points: [{x:534,y:270},{x:706,y:212},{x:736,y:291},{x:559,y:343}] },
    { id: 'stool', x: 652, y: 344, rx: 23, ry: 23 },
    { id: 'tv-rack', x: 770, y: 133, w: 113, h: 70 },
    { id: 'top-cases', x: 909, y: 119, w: 94, h: 125 },
    { id: 'yellow-red-sofa', x: 1008, y: 138, w: 318, h: 111 },
    { id: 'top-speaker', x: 1330, y: 143, w: 76, h: 126 },
    { id: 'tea', x: 128, y: 373, w: 175, h: 159 },
    { id: 'tea-speaker', x: 141, y: 516, w: 73, h: 62 },
    { id: 'drums', x: 620, y: 735, rx: 131, ry: 108 },
    { id: 'monitor-left', points: [{x:402,y:626},{x:467,y:656},{x:445,y:705},{x:381,y:678}] },
    { id: 'monitor-bottom', x: 396, y: 846, w: 61, h: 66 },
    { id: 'monitor-right', x: 759, y: 846, w: 72, h: 66 },
    { id: 'right-racks', x: 1240, y: 776, w: 174, h: 150 },
    { id: 'right-stack', x: 1373, y: 680, w: 69, h: 152 },
  ],
};
export const CHARACTERS = [
  { id: 'albert', name: 'Альберт', atlasRow: 0, playable: true },
  { id: 'loik', name: 'Лоик', atlasRow: 1, active: true, spawn: { x: 1000, y: 460 },
    wander: [{x:1000,y:460},{x:1130,y:635},{x:966,y:670},{x:835,y:456}] },
  { id: 'samat', name: 'Самат', active: false },
  { id: 'sveta', name: 'Света', active: false },
  { id: 'tema', name: 'Тёма', active: false },
  { id: 'vovan', name: 'Вован', active: false },
  { id: 'katya', name: 'Катя', active: false },
];
export const OBJECTS = [
  { id: 'microphone', name: 'Микрофон', x: 477, y: 573, icon: '!', marker: {x:485,y:551} },
  { id: 'cable', name: 'Кабель', x: 751, y: 378, icon: 'ϟ', marker: {x:737,y:291} },
  { id: 'amplifier', name: 'Усилитель', x: 1192, y: 805, icon: 'ϟ', marker: {x:1258,y:746} },
  { id: 'console', name: 'Пульт', x: 740, y: 230, icon: 'ϟ', marker: {x:602,y:138} },
  { id: 'curtain', name: 'Шторка', ...WORLD.curtain, icon: '…', marker: {x:145,y:706} },
];
export const DIALOGUES = {
  greeting: 'Всё спокойно. Пока можно просто освоиться.',
  microphone: 'Микрофон молчит. Проверю кабель, усилитель и пульт.',
  sad: 'Мне что-то совсем невесело…',
  escort: 'Пойдём со мной.',
  follow: 'Иду за тобой.',
  waiting: 'Немного подождём.',
  happy: 'О, теперь совсем другое дело!',
  notHere: 'Здесь всё в порядке. Проверю дальше.',
  fixed: 'Есть контакт. Микрофон снова работает!',
  peaceful: 'Сейчас всё в порядке.',
};
export const EVENT_TYPES = {
  microphone: { kind: 'technical', startObject: 'microphone', checks: ['cable','amplifier','console'], reward: 11 },
  comfort: { kind: 'social', npcId: 'loik', reward: 14 },
};
// Real recordings can be connected here later. Empty paths use quiet temporary tones.
export const AUDIO = { start: null, solved: null, problem: null, return: null };
