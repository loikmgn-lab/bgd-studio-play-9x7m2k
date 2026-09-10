// Lossless delivery encoding only. Source artwork and decoded RGBA pixels stay unchanged.
import {createRequire} from 'node:module';
import {stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_PATH||'/Users/yanafidoeva/hr-platform/node_modules/sharp');
const names=['studio','characters-key','crew-key','friends-realistic-key','nikita-drink-key','david-drink-key','newcomers-key','metallica-drink-key','tema-break-key','nikita-cheer-key'];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const report=[];
for(const name of names){
 const input=`public/assets/${name}.png`,output=`public/assets/${name}.webp`;
 await sharp(input).webp({lossless:true,effort:6}).toFile(output);
 const before=await sharp(input).ensureAlpha().raw().toBuffer(),after=await sharp(output).ensureAlpha().raw().toBuffer();
 if(hash(before)!==hash(after))throw new Error(`RGBA mismatch: ${name}`);
 report.push({name,sourceBytes:(await stat(input)).size,deliveryBytes:(await stat(output)).size,identicalRGBA:true});
}
const totals=report.reduce((t,r)=>({sourceBytes:t.sourceBytes+r.sourceBytes,deliveryBytes:t.deliveryBytes+r.deliveryBytes}),{sourceBytes:0,deliveryBytes:0});
await writeFile('artifacts/asset-packing.json',JSON.stringify({report,totals},null,2));console.log(JSON.stringify(totals));
