import { PDF_TEXT_LAYOUT_JS } from './pdf-text-layout';

/**
 * Offline PDF.js viewer. PDF.js parses in a real Web Worker (falling back to the main thread
 * when the WebView refuses blob workers), the document arrives in base64 chunks, renders are
 * coalesced and serialized with bounded canvas memory, and neighbouring pages are pre-rendered.
 */
export function getPDFViewerHTML(runtime: string, worker: string): string {
  const safeScript = (source: string) => source.replace(/<\/script/gi, '<\\/script');
  return String.raw`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;width:100%;height:100%;background:#e9e3d9;overflow:hidden}
#pages{height:100%;overflow:auto;padding:12px;overscroll-behavior:contain;touch-action:pan-x pan-y}
canvas{display:block;margin:0 auto;background:#fff;box-shadow:0 2px 12px #34271b22}
.note{font:15px/1.5 sans-serif;text-align:center;padding:40px 20px;color:#594b3d}
</style></head><body><div id="pages"><div class="note">Preparando documento…</div></div>
<script type="text/plain" id="pdf-worker-src">${safeScript(worker)}</script>
<script>
function send(type, data) {
  if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({type:type},data||{})));
}
window.onerror=function(message){send('PDF_ERROR',{error:String(message)});};
window.onunhandledrejection=function(event){send('PDF_ERROR',{error:String(event.reason && event.reason.message || event.reason)});};
</script>
<script>${safeScript(runtime)}</script>
<script>${PDF_TEXT_LAYOUT_JS}</script>
<script>
(function(){
  var MAX_PIXELS=6000000, MAX_SIDE=4096, MIN_ZOOM=0.5, MAX_ZOOM=3;
  var doc=null, current=1, zoom=1, queue=Promise.resolve(), wanted=null;
  var chunks=[], received=0, cache=[], textCache={}, edgeMemory={}, prefetchTimer, engine=null;
  var container=document.getElementById('pages');
  function noop(){}
  function explain(error){
    var name=error && error.name;
    if(name==='PasswordException') return 'Este PDF tiene contraseña. Importa una copia desbloqueada.';
    if(name==='InvalidPDFException') return 'El archivo no es un PDF válido o está dañado.';
    if(name==='MissingPDFException') return 'El archivo PDF está vacío o incompleto.';
    return String(error && error.message || error || 'No se pudo abrir el PDF.');
  }

  // ---- PDF.js engine: real worker when possible, main thread otherwise ----
  function workerSource(){ var el=document.getElementById('pdf-worker-src'); return el && el.textContent || ''; }
  function inlineWorker(){
    if(typeof pdfjsWorker!=='undefined') return;
    var script=document.createElement('script'); script.text=workerSource();
    (document.head||document.body).appendChild(script);
  }
  function startWorker(){
    return new Promise(function(resolve,reject){
      if(typeof Worker==='undefined'||typeof Blob==='undefined'||typeof URL==='undefined'||!URL.createObjectURL) throw new Error('Sin soporte de workers');
      var source=workerSource(); if(!source) throw new Error('Sin motor PDF');
      var worker=new Worker(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));
      var settled=false;
      function fail(){ if(settled) return; settled=true; clearTimeout(timer); worker.terminate(); reject(new Error('Worker no disponible')); }
      var timer=setTimeout(fail,6000);
      worker.addEventListener('error',fail);
      worker.addEventListener('message',function ready(event){
        if(settled||!event.data||event.data.action!=='ready') return;
        settled=true; clearTimeout(timer); worker.removeEventListener('message',ready); worker.removeEventListener('error',fail);
        resolve(worker);
      });
    });
  }
  function ensureEngine(){
    if(!engine) engine=startWorker().then(function(worker){ pdfjsLib.GlobalWorkerOptions.workerPort=worker; })
      .catch(function(){ inlineWorker(); });
    return engine;
  }

  // ---- Document transfer ----
  window.beginPDF=function(){ chunks=[]; received=0; };
  window.appendPDFChunk=function(base64){
    var raw=atob(base64), bytes=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
    chunks.push(bytes); received+=bytes.length;
  };
  async function openDocument(){
    await ensureEngine();
    var data=new Uint8Array(received), offset=0;
    chunks.forEach(function(part){ data.set(part,offset); offset+=part.length; });
    chunks=[]; received=0;
    if(!data.length) throw new Error('El archivo PDF está vacío.');
    if(doc){ var old=doc; doc=null; old.destroy().catch(noop); }
    cache=[]; textCache={}; edgeMemory={};
    doc=await pdfjsLib.getDocument({data:data,isEvalSupported:false,stopAtErrors:false,disableAutoFetch:true}).promise;
  }
  window.openPDF=async function(initialPage){
    try{
      await openDocument();
      await render(initialPage||1);
      send('PDF_READY',{page:current,totalPages:doc.numPages});
    }catch(error){send('PDF_ERROR',{error:explain(error)});}
  };
  window.loadPDF=function(base64, initialPage){ window.beginPDF(); window.appendPDFChunk(base64); return window.openPDF(initialPage); };

  // ---- Rendering ----
  function layoutKey(number){ return number+'|'+zoom+'|'+container.clientWidth; }
  async function paint(number){
    var page=await doc.getPage(number);
    try{
      var base=page.getViewport({scale:1});
      var cssScale=Math.max(100,container.clientWidth-24)/base.width*zoom;
      var css=page.getViewport({scale:cssScale});
      var density=Math.min(window.devicePixelRatio||1,3,Math.sqrt(MAX_PIXELS/(css.width*css.height)),MAX_SIDE/Math.max(css.width,css.height));
      var viewport=page.getViewport({scale:cssScale*density});
      var canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.floor(viewport.width));
      canvas.height=Math.max(1,Math.floor(viewport.height));
      canvas.style.width=css.width+'px';canvas.style.height=css.height+'px';
      var context=canvas.getContext('2d',{alpha:false});
      context.fillStyle='#fff'; context.fillRect(0,0,canvas.width,canvas.height);
      await page.render({canvasContext:context,viewport:viewport}).promise;
      return canvas;
    } finally { page.cleanup(); }
  }
  function takeCached(key){
    for(var i=0;i<cache.length;i++) if(cache[i].key===key) return cache.splice(i,1)[0].canvas;
    return null;
  }
  async function draw(number){
    if(!doc) throw new Error('El documento todavía no está listo.');
    number=Math.max(1,Math.min(doc.numPages,Math.round(number)||1));
    var samePage=number===current && container.firstChild;
    var fx=samePage ? (container.scrollLeft+container.clientWidth/2)/Math.max(1,container.scrollWidth) : 0;
    var fy=samePage ? container.scrollTop/Math.max(1,container.scrollHeight) : 0;
    var canvas=takeCached(layoutKey(number)), failure=null;
    if(!canvas){ try{ canvas=await paint(number); }catch(error){ failure=error; } }
    if(failure){
      var note=document.createElement('div'); note.className='note';
      note.textContent='La página '+number+' está dañada y no se puede mostrar. Puedes seguir con las demás.';
      container.replaceChildren(note);
    } else container.replaceChildren(canvas);
    if(samePage){ container.scrollLeft=fx*container.scrollWidth-container.clientWidth/2; container.scrollTop=fy*container.scrollHeight; }
    else { container.scrollTop=0; container.scrollLeft=0; }
    current=number;
    send('PAGE_CHANGED',{page:current,totalPages:doc.numPages,zoom:zoom});
    if(failure) send('PAGE_ERROR',{page:number,error:explain(failure)});
    schedulePrefetch();
  }
  // Coalesces bursts of navigation: only the latest requested page is drawn.
  function render(number){
    wanted=number;
    var job=queue.catch(noop).then(function(){
      if(wanted===null) return;
      var next=wanted; wanted=null;
      return draw(next);
    });
    queue=job;
    return job;
  }
  function schedulePrefetch(){
    clearTimeout(prefetchTimer);
    if(!doc||zoom>1.5){ cache=[]; return; }
    prefetchTimer=setTimeout(function(){
      var targets=[current+1,current-1].filter(function(n){ return doc && n>=1 && n<=doc.numPages; });
      var keys=targets.map(layoutKey);
      cache=cache.filter(function(entry){ return keys.indexOf(entry.key)>=0; });
      targets.forEach(function(number){
        queue=queue.catch(noop).then(function(){
          var key=layoutKey(number);
          if(wanted!==null||!doc||cache.some(function(entry){ return entry.key===key; })) return;
          return paint(number).then(function(canvas){
            if(key!==layoutKey(number)) return;
            cache.push({key:key,canvas:canvas}); while(cache.length>2) cache.shift();
          }).catch(noop);
        });
      });
    },250);
  }
  window.goToPage=function(number){return render(number).catch(function(error){send('PDF_ERROR',{error:explain(error)});});};
  window.setPDFZoom=function(value){
    zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,Number(value)||1));
    cache=[];
    return window.goToPage(current);
  };

  // ---- Text for speech and analysis ----
  async function pageText(number){
    if(Object.prototype.hasOwnProperty.call(textCache,number)) return textCache[number];
    var page=await doc.getPage(number);
    try{
      var content=await page.getTextContent();
      var result=pdfLayoutPage(content.items,{view:page.view,number:number},edgeMemory);
      textCache[number]=result.text;
      return result.text;
    } finally { page.cleanup(); }
  }
  window.requestPageText=async function(number, requestId){
    try{
      await render(number);
      var text=await pageText(current);
      send('PAGE_TEXT',{text:text,page:current,requestId:requestId});
    }catch(error){send('SPEECH_ERROR',{error:explain(error),requestId:requestId});}
  };
  // Background reading: hands the text of a page range to the app in small batches.
  var textJob=0;
  window.requestPageTexts=async function(from, to, requestId){
    var job=++textJob, batch=[];
    try{
      if(!doc) throw new Error('El documento todavía no está listo.');
      to=Math.min(doc.numPages,to);
      for(var number=from;number<=to;number++){
        if(job!==textJob) return;
        var text='';
        try{ text=await pageText(number); }catch(error){}
        batch.push({page:number,text:text});
        if(batch.length>=8||number===to){ send('PAGE_TEXTS',{requestId:requestId,pages:batch,done:number===to}); batch=[]; }
      }
      if(from>to) send('PAGE_TEXTS',{requestId:requestId,pages:[],done:true});
    }catch(error){send('SPEECH_ERROR',{error:explain(error),requestId:requestId});}
  };
  window.cancelPageTexts=function(){ textJob++; };
  window.analyzePDF=async function(){
    try{
      await openDocument();
      var pages=[];
      var numbers=pdfSamplePages(doc.numPages,12);
      for(var i=0;i<numbers.length;i++){
        try{
          var page=await doc.getPage(numbers[i]);
          var content=await page.getTextContent();
          pages.push(pdfLayoutPage(content.items,{view:page.view,number:numbers[i]},null));
          page.cleanup();
        }catch(error){ pages.push({lines:[],text:'',letters:0}); }
      }
      var result=pdfAnalyzeSample(pages,doc.numPages);
      var finished=doc; doc=null; finished.destroy().catch(noop);
      send('ANALYSIS',result);
    }catch(error){send('PDF_ERROR',{error:explain(error)});}
  };

  // ---- Gesture: swipe to turn pages (zoom is only controlled from the app's buttons) ----
  var touch=null;
  if(container.addEventListener){
    container.addEventListener('touchstart',function(event){
      touch=event.touches.length===1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY,time:Date.now(),left:container.scrollLeft} : null;
    },{passive:true});
    container.addEventListener('touchend',function(event){
      if(!touch) return;
      var point=event.changedTouches[0], dx=point.clientX-touch.x, dy=point.clientY-touch.y;
      var quick=Date.now()-touch.time<600, left=touch.left; touch=null;
      var maxLeft=container.scrollWidth-container.clientWidth;
      var atEdge=maxLeft<=2||(dx<0&&left>=maxLeft-2)||(dx>0&&left<=2);
      if(doc&&quick&&atEdge&&Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.8) send('SWIPE',{direction:dx<0?1:-1});
    });
  }
  var resizeTimer;
  window.addEventListener('resize',function(){
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(function(){ if(doc){ cache=[]; window.goToPage(current); } },200);
  });
  if(typeof pdfjsLib==='undefined') throw new Error('No se pudo iniciar el motor PDF local.');
  ensureEngine();
  send('VIEWER_READY');
})();
</script></body></html>`;
}
