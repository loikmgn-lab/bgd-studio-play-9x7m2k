import {AUDIO} from './content.js';
export class Sound {
  constructor(){this.enabled=false;this.context=null;}
  async toggle(){this.enabled=!this.enabled;if(this.enabled){this.context??=new(window.AudioContext||window.webkitAudioContext)();await this.context.resume();this.play('start');}return this.enabled;}
  play(event){
    if(!this.enabled)return;
    if(AUDIO[event]){const track=new Audio(AUDIO[event]);track.volume=.3;track.play().catch(()=>{});return;}
    const context=this.context;if(!context)return;
    const notes=event==='problem'?[164]:event==='start'?[196,294]:[220,330,440];
    notes.forEach((hz,i)=>{const o=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.09;o.type='sine';o.frequency.value=hz;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.025,at+.015);gain.gain.exponentialRampToValueAtTime(.001,at+.24);o.connect(gain);gain.connect(context.destination);o.start(at);o.stop(at+.25);});
  }
}
