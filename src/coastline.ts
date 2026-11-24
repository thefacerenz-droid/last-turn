import './ui/style.css';
import { GameManager } from './core/GameManager';

const loading=document.getElementById('loading')!;
async function boot(){
  try{
    const game=new GameManager(document.querySelector<HTMLCanvasElement>('#scene')!,document.getElementById('interface')!);
    await game.init();
    loading.classList.add('hide');setTimeout(()=>loading.hidden=true,370);
  }catch(error){
    console.error(error);
    const label=document.getElementById('load-label')!;
    label.textContent=error instanceof Error&&/webgl/i.test(error.message)?'WebGL 2 could not start. Enable hardware acceleration in a desktop browser, then reload.':'The game could not load. '+(error instanceof Error?error.message:String(error));
    loading.querySelector('i')?.remove();const retry=document.createElement('button');retry.className='secondary';retry.textContent='Reload game';retry.onclick=()=>location.reload();retry.style.pointerEvents='auto';loading.append(retry);
  }
}
void boot();
