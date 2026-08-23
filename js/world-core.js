export const TILE=24;
export const FATHOMS_PER_TILE=.5;
export function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
export function hash2(x,y,seed=0){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(seed|0,1442695041))|0;h=(h^(h>>>13));h=Math.imul(h,1274126177);h^=h>>>16;return (h>>>0)/4294967295;}
export function depthFromY(y){return Math.max(0,(-y)/TILE*FATHOMS_PER_TILE);}
export function yFromDepth(depth){return -(Math.max(0,Number(depth)||0)/FATHOMS_PER_TILE)*TILE;}
export function stratumIndex(depth){return Math.max(0,Math.floor((Number(depth)||0)/500));}
