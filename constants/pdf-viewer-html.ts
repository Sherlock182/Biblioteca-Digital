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
#pages{position:relative;height:100%;overflow:auto;padding:12px;overscroll-behavior:contain;touch-action:pan-x pan-y}
#pages.marking{touch-action:none}
.page{position:relative;margin:0 auto;box-shadow:0 2px 12px #34271b22}
canvas{display:block;background:#fff}
.layer{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none}
.hl{position:absolute;border-radius:2px;background:rgba(255,214,0,.42);mix-blend-mode:multiply}
.hl.sel{background:rgba(255,170,0,.5);box-shadow:0 2px 0 rgba(214,120,0,.9)}
.hl.flash{animation:flash .7s ease-in-out 4}
@keyframes flash{0%,100%{background:rgba(255,214,0,.42)}50%{background:rgba(255,140,0,.85)}}
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
  // Marking: words of the page with their boxes (fractions of the page), the live selection, saved marks.
  var wordsCache={}, markMode=false, sel=null, marksList=[], pageEl=null;
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
    cache=[]; textCache={}; edgeMemory={}; wordsCache={}; sel=null; pageEl=null;
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
      container.replaceChildren(note); pageEl=null;
    } else {
      var wrap=document.createElement('div'); wrap.className='page';
      wrap.style.width=canvas.style.width; wrap.style.height=canvas.style.height;
      var marksLayer=document.createElement('div'), selLayer=document.createElement('div');
      marksLayer.className=selLayer.className='layer';
      wrap.append(canvas,marksLayer,selLayer);
      container.replaceChildren(wrap);
      pageEl={number:number,wrap:wrap,marks:marksLayer,sel:selLayer};
    }
    if(number!==current && sel){ sel=null; reportSelection(); }
    if(samePage){ container.scrollLeft=fx*container.scrollWidth-container.clientWidth/2; container.scrollTop=fy*container.scrollHeight; }
    else { container.scrollTop=0; container.scrollLeft=0; }
    current=number;
    paintMarks(); paintSelection();
    if(markMode) prepareMarking();
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

  // ---- Marking: the reader drags a finger over the page's words, like a highlighter ----
  async function pageWords(number){
    if(wordsCache[number]) return wordsCache[number];
    var page=await doc.getPage(number);
    try{
      var viewport=page.getViewport({scale:1}), content=await page.getTextContent(), words=[];
      content.items.forEach(function(item){
        if(!item || typeof item.str!=='string' || !item.str.trim() || !(item.width>0)) return;
        var t=pdfjsLib.Util.transform(viewport.transform,item.transform);
        if(Math.abs(t[1])>Math.abs(t[0])*0.1) return; // rotated text cannot be highlighted with flat boxes
        var size=Math.hypot(t[2],t[3]) || 10, width=item.width*viewport.scale, length=item.str.length;
        var top=t[5]-size*0.85, re=/\S+/g, match, last=null;
        while((match=re.exec(item.str))){
          last={t:match[0], x:(t[4]+width*match.index/length)/viewport.width, y:top/viewport.height,
            w:(width*match[0].length/length)/viewport.width, h:size*1.12/viewport.height, tail:false};
          words.push(last);
        }
        if(last) last.tail=true;
      });
      var keys=Object.keys(wordsCache); if(keys.length>4) delete wordsCache[keys[0]];
      wordsCache[number]=words;
      return words;
    } finally { page.cleanup(); }
  }
  function prepareMarking(){
    var number=current;
    pageWords(number).then(function(words){
      if(markMode && number===current) send('MARK_MODE',{page:number,words:words.length});
    }).catch(function(){ if(markMode && number===current) send('MARK_MODE',{page:number,words:0}); });
  }
  function box(left,top,width,height,className,id){
    var el=document.createElement('div'); el.className=className;
    el.style.left=left*100+'%'; el.style.top=top*100+'%'; el.style.width=width*100+'%'; el.style.height=height*100+'%';
    if(id) el.setAttribute('data-id',id);
    return el;
  }
  // Consecutive words on the same line become one box.
  function lineBoxes(words,from,to){
    var lines=[];
    for(var i=from;i<=to;i++){
      var w=words[i], line=lines[lines.length-1];
      if(line && Math.abs(w.y-line.y)<line.h*0.5 && w.x>=line.x-0.01){ line.r=Math.max(line.r,w.x+w.w); line.h=Math.max(line.h,w.h); }
      else lines.push({x:w.x,y:w.y,r:w.x+w.w,h:w.h});
    }
    var round=function(v){ return Math.round(v*10000)/10000; };
    return lines.map(function(l){ return [round(l.x),round(l.y),round(l.r-l.x),round(l.h)]; });
  }
  function selectionRange(){
    var words=sel && sel.page===current && wordsCache[current];
    if(!words || !words.length) return null;
    return {words:words, from:Math.min(sel.a,sel.b), to:Math.max(sel.a,sel.b)};
  }
  function paintSelection(){
    if(!pageEl) return;
    pageEl.sel.replaceChildren();
    var range=selectionRange();
    if(range) lineBoxes(range.words,range.from,range.to).forEach(function(r){ pageEl.sel.append(box(r[0],r[1],r[2],r[3],'hl sel')); });
  }
  function paintMarks(){
    if(!pageEl) return;
    pageEl.marks.replaceChildren();
    marksList.forEach(function(mark){
      if(mark.page!==pageEl.number || !mark.rects) return;
      mark.rects.forEach(function(r){ pageEl.marks.append(box(r[0],r[1],r[2],r[3],'hl',mark.id)); });
    });
  }
  function reportSelection(){
    var range=selectionRange();
    if(!range){ send('MARK_SELECTION',{count:0}); return; }
    var text='';
    for(var i=range.from;i<=range.to;i++){
      var w=range.words[i].t, prev=i>range.from ? range.words[i-1] : null;
      // A word split at the end of a line ("conti-" + "nuaba") is joined back.
      if(prev && prev.tail && /[A-Za-zÀ-ÿ]-$/.test(prev.t) && /^[a-záéíóúüñ]/.test(w)) text=text.slice(0,-1)+w;
      else text+=(text?' ':'')+w;
    }
    send('MARK_SELECTION',{page:current,count:range.to-range.from+1,text:text,rects:lineBoxes(range.words,range.from,range.to)});
  }
  // Index of the word under (or nearest to) a screen point.
  function wordAt(clientX,clientY){
    var words=wordsCache[current];
    if(!pageEl || !words || !words.length) return null;
    var r=pageEl.wrap.getBoundingClientRect(), x=(clientX-r.left)/r.width, y=(clientY-r.top)/r.height, best=null, bestDistance=Infinity;
    for(var i=0;i<words.length;i++){
      var w=words[i];
      var dx=x<w.x ? w.x-x : x>w.x+w.w ? x-w.x-w.w : 0, dy=y<w.y ? w.y-y : y>w.y+w.h ? y-w.y-w.h : 0;
      var distance=dx*r.width+dy*r.height*3;
      if(distance<bestDistance){ bestDistance=distance; best=i; }
    }
    return best;
  }
  function markAt(clientX,clientY){
    if(!pageEl) return null;
    var r=pageEl.wrap.getBoundingClientRect(), x=(clientX-r.left)/r.width, y=(clientY-r.top)/r.height, pad=6/r.width;
    for(var i=marksList.length-1;i>=0;i--){
      var mark=marksList[i];
      if(mark.page!==current || !mark.rects) continue;
      for(var j=0;j<mark.rects.length;j++){
        var b=mark.rects[j];
        if(x>=b[0]-pad && x<=b[0]+b[2]+pad && y>=b[1]-pad*2 && y<=b[1]+b[3]+pad*2) return mark.id;
      }
    }
    return null;
  }
  window.setMarkMode=function(on){
    markMode=!!on; sel=null; paintSelection();
    container.classList.toggle('marking',markMode);
    if(markMode && doc) prepareMarking();
  };
  window.clearMarkSelection=function(){ sel=null; paintSelection(); reportSelection(); };
  window.setMarks=function(list){ marksList=Array.isArray(list) ? list : []; paintMarks(); };
  // Opened from the bookmarks: shows the mark's page, scrolls to it and makes it blink.
  window.flashMark=function(id){
    var mark=marksList.find(function(item){ return item.id===id; });
    if(!mark) return;
    (mark.page!==current ? render(mark.page) : Promise.resolve()).then(function(){
      if(!pageEl || !mark.rects || !mark.rects.length) return;
      container.scrollTop=pageEl.wrap.offsetTop+mark.rects[0][1]*pageEl.wrap.offsetHeight-container.clientHeight*0.3;
      pageEl.marks.querySelectorAll('[data-id="'+id+'"]').forEach(function(el){ el.classList.add('flash'); });
    }).catch(noop);
  };

  // ---- Gesture: swipe to turn pages (zoom is only controlled from the app's buttons) ----
  // While marking, one finger highlights instead: dragging selects from the first word touched to
  // the word under the finger; a tap selects one word, or extends the selection up to it.
  var touch=null;
  if(container.addEventListener){
    container.addEventListener('touchstart',function(event){
      touch=event.touches.length===1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY,time:Date.now(),left:container.scrollLeft,moved:false} : null;
      if(touch && markMode) touch.word=wordAt(touch.x,touch.y);
    },{passive:true});
    container.addEventListener('touchmove',function(event){
      if(!markMode || !touch) return;
      event.preventDefault();
      var point=event.touches[0];
      if(!touch.moved && Math.hypot(point.clientX-touch.x,point.clientY-touch.y)>8){
        touch.moved=true;
        if(touch.word!==null && touch.word!==undefined) sel={page:current,a:touch.word,b:touch.word};
      }
      if(!touch.moved || !sel) return;
      var word=wordAt(point.clientX,point.clientY);
      if(word!==null && word!==sel.b){ sel.b=word; paintSelection(); }
      // Near the top or bottom edge the page scrolls, so a passage can continue off screen.
      var r=container.getBoundingClientRect();
      if(point.clientY<r.top+48) container.scrollTop-=14; else if(point.clientY>r.bottom-48) container.scrollTop+=14;
    },{passive:false});
    container.addEventListener('touchend',function(event){
      if(!touch) return;
      var point=event.changedTouches[0], dx=point.clientX-touch.x, dy=point.clientY-touch.y;
      var quick=Date.now()-touch.time<600, left=touch.left, start=touch; touch=null;
      if(markMode){
        if(!start.moved && start.word!==null && start.word!==undefined){
          if(sel && sel.page===current) sel.b=start.word; else sel={page:current,a:start.word,b:start.word};
          paintSelection();
        }
        reportSelection();
        return;
      }
      if(quick && Math.abs(dx)<10 && Math.abs(dy)<10){
        var id=markAt(point.clientX,point.clientY);
        if(id){ send('MARK_TAPPED',{id:id}); return; }
      }
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
