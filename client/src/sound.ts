const LAUTSTAERKE = 0.07;
const XP_TOENE = [659.25, 987.77];
const BESONDERE_TOENE = [659.25, 830.61, 987.77, 1318.51];
const LEVEL_TOENE = [523.25, 659.25, 783.99, 1046.5, 1318.51];
const TON_ABSTAND_SEKUNDEN = 0.08;
const TON_DAUER_SEKUNDEN = 0.35;

let audioKontext: AudioContext | null = null;

function holeAudioKontext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') {
    return null;
  }
  audioKontext ??= new AudioContext();
  if (audioKontext.state === 'suspended') {
    void audioKontext.resume();
  }
  return audioKontext;
}

function spieleTonfolge(frequenzen: number[], abstand = TON_ABSTAND_SEKUNDEN): void {
  const kontext = holeAudioKontext();
  if (!kontext) {
    return;
  }
  const start = kontext.currentTime;

  frequenzen.forEach((frequenz, index) => {
    const beginn = start + index * abstand;
    const oszillator = kontext.createOscillator();
    const lautstaerke = kontext.createGain();

    oszillator.type = 'sine';
    oszillator.frequency.value = frequenz;
    lautstaerke.gain.setValueAtTime(0, beginn);
    lautstaerke.gain.linearRampToValueAtTime(LAUTSTAERKE, beginn + 0.01);
    lautstaerke.gain.exponentialRampToValueAtTime(0.0001, beginn + TON_DAUER_SEKUNDEN);

    oszillator.connect(lautstaerke).connect(kontext.destination);
    oszillator.start(beginn);
    oszillator.stop(beginn + TON_DAUER_SEKUNDEN);
  });
}

export function spieleXpSound(besonders: boolean): void {
  spieleTonfolge(besonders ? BESONDERE_TOENE : XP_TOENE);
}

export function spieleLevelSound(): void {
  spieleTonfolge(LEVEL_TOENE, TON_ABSTAND_SEKUNDEN * 1.5);
}
