(() => {
  'use strict';
  const KEY = 'atlas-script';
  const originals = new WeakMap();
  const attrOriginals = new WeakMap();
  const skipTags = new Set(['SCRIPT','STYLE','CODE','PRE','TEXTAREA','SVG','PATH','NOSCRIPT']);
  let mode = 'latn';

  const singles = {
    'a':'а','b':'б','c':'ц','č':'ч','ć':'ћ','d':'д','đ':'ђ','e':'е','f':'ф','g':'г','h':'х','i':'и','j':'ј','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п','r':'р','s':'с','š':'ш','t':'т','u':'у','v':'в','z':'з','ž':'ж',
    'A':'А','B':'Б','C':'Ц','Č':'Ч','Ć':'Ћ','D':'Д','Đ':'Ђ','E':'Е','F':'Ф','G':'Г','H':'Х','I':'И','J':'Ј','K':'К','L':'Л','M':'М','N':'Н','O':'О','P':'П','R':'Р','S':'С','Š':'Ш','T':'Т','U':'У','V':'В','Z':'З','Ž':'Ж'
  };

  function safeGet(){ try { return localStorage.getItem(KEY) || 'latn'; } catch(_) { return 'latn'; } }
  function safeSet(v){ try { localStorage.setItem(KEY,v); } catch(_) {} }
  function shouldSkip(el){
    if(!el) return true;
    if(skipTags.has(el.tagName)) return true;
    return Boolean(el.closest('.atlas-course-tools,[data-no-course-translit]'));
  }
  function cyrillize(input){
    let s = input || '';
    const digraphs = [
      [/DŽ/g,'Џ'],[/Dž/g,'Џ'],[/dž/g,'џ'],
      [/LJ/g,'Љ'],[/Lj/g,'Љ'],[/lj/g,'љ'],
      [/NJ/g,'Њ'],[/Nj/g,'Њ'],[/nj/g,'њ']
    ];
    digraphs.forEach(([re,to]) => { s=s.replace(re,to); });
    return s.replace(/[A-Za-zČĆĐŠŽčćđšž]/g, ch => singles[ch] || ch);
  }
  function rememberText(node){ if(!originals.has(node)) originals.set(node,node.nodeValue || ''); }
  function originalAttr(el,name){
    let store=attrOriginals.get(el); if(!store){store={};attrOriginals.set(el,store);}
    if(!(name in store)) store[name]=el.getAttribute(name)||'';
    return store[name];
  }
  function transform(root){
    if(!root) return;
    if(root.nodeType===Node.TEXT_NODE){
      if(shouldSkip(root.parentElement)) return;
      rememberText(root); const original=originals.get(root);
      root.nodeValue = mode==='cyrl' ? cyrillize(original) : original;
      return;
    }
    if(root.nodeType!==Node.ELEMENT_NODE && root!==document.body) return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(shouldSkip(node.parentElement)) return;
      rememberText(node); const original=originals.get(node);
      node.nodeValue = mode==='cyrl' ? cyrillize(original) : original;
    });
    if(root.querySelectorAll){
      root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{
        if(shouldSkip(el)) return;
        ['placeholder','title','aria-label'].forEach(name=>{
          if(!el.hasAttribute(name)) return;
          const original=originalAttr(el,name);
          el.setAttribute(name, mode==='cyrl' ? cyrillize(original) : original);
        });
      });
    }
  }
  function updateTools(){
    const back=document.querySelector('.atlas-course-back');
    if(back) back.textContent = mode==='cyrl' ? '← Назад у Атлас' : '← Nazad u Atlas';
    document.querySelectorAll('.atlas-course-script button').forEach(btn=>{
      btn.setAttribute('aria-pressed', String(btn.dataset.script===mode));
    });
    document.documentElement.lang = mode==='cyrl' ? 'sr-Cyrl' : 'sr-Latn';
  }
  function setMode(next){
    mode = next==='cyrl' ? 'cyrl' : 'latn';
    safeSet(mode);
    transform(document.body);
    updateTools();
  }
  function addTools(){
    if(document.querySelector('.atlas-course-tools')) return;
    const tools=document.createElement('div');
    tools.className='atlas-course-tools';
    tools.setAttribute('data-no-course-translit','1');
    tools.innerHTML='<a class="atlas-course-back" href="../index.html">← Nazad u Atlas</a><div class="atlas-course-script" aria-label="Izbor pisma"><button type="button" data-script="cyrl" aria-pressed="false">Ћир</button><button type="button" data-script="latn" aria-pressed="true">Lat</button></div>';
    document.body.appendChild(tools);
    tools.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.script)));
  }
  document.addEventListener('DOMContentLoaded',()=>{
    mode=safeGet()==='cyrl' ? 'cyrl':'latn';
    addTools();
    // Rise mounts asynchronously. Apply once now, then keep new content in sync.
    transform(document.body); updateTools();
    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        mutation.addedNodes.forEach(node=>{
          if(node.nodeType===Node.ELEMENT_NODE || node.nodeType===Node.TEXT_NODE) transform(node);
        });
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  });
})();
