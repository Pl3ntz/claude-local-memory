#!/usr/bin/env node
var E=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var X=E((ke,x)=>{var oe=require("better-sqlite3"),L=require("node:fs"),O=require("node:path"),re=require("node:os"),C=O.join(re.homedir(),".local-memory"),U=O.join(C,"memory.db"),T=null;function se(e){L.existsSync(e)||L.mkdirSync(e,{recursive:!0,mode:448})}function ie(e=U){if(T)return T;let t=e===":memory:";t||se(O.dirname(e));let n=new oe(e);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),w(n),!t)try{L.chmodSync(e,384)}catch{}return T=n,n}function w(e){e.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      container_tag TEXT NOT NULL,
      project_name TEXT,
      memory_type TEXT NOT NULL DEFAULT 'session_turn',
      session_id TEXT,
      custom_id TEXT UNIQUE,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content, project_name,
      content=memories, content_rowid=id,
      tokenize='porter unicode61'
    );

    CREATE TABLE IF NOT EXISTS profile_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_tag TEXT NOT NULL,
      fact_type TEXT NOT NULL CHECK (fact_type IN ('static','dynamic')),
      fact_text TEXT NOT NULL,
      source_memory_id INTEGER REFERENCES memories(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(container_tag, fact_type, fact_text)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      container_tag TEXT NOT NULL,
      project_name TEXT,
      last_captured_uuid TEXT,
      started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      ended_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_memories_container ON memories(container_tag);
    CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
    CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    CREATE INDEX IF NOT EXISTS idx_profile_container ON profile_facts(container_tag, fact_type);
  `),ae(e)}function ae(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
    CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, project_name)
      VALUES (new.id, new.content, new.project_name);
    END;

    CREATE TRIGGER memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, project_name)
      VALUES ('delete', old.id, old.content, old.project_name);
      INSERT INTO memories_fts(rowid, content, project_name)
      VALUES (new.id, new.content, new.project_name);
    END;

    CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, project_name)
      VALUES ('delete', old.id, old.content, old.project_name);
    END;
  `)}function ce(){T&&(T.close(),T=null)}x.exports={getDb:ie,closeDb:ce,runMigrations:w,DEFAULT_DB_PATH:U,DEFAULT_DB_DIR:C}});var v=E((He,b)=>{var ue=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function le(e,t=1e5){if(!e||typeof e!="string")return"";let n=e;for(let o of ue)n=n.replace(o,"");return n.length>t&&(n=n.slice(0,t)),n}function me(e,t=1,n=1e5){return e.length<t?{valid:!1,reason:`content below minimum length (${t})`}:e.length>n?{valid:!1,reason:`content exceeds maximum length (${n})`}:{valid:!0}}function de(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function Ee(e){if(!e||typeof e!="object")return{};let t={},n=0;for(let[o,r]of Object.entries(e)){if(n>=50)break;o.length>128||/[^\w.-]/.test(o)||(typeof r=="string"?(t[o]=r.slice(0,1024),n++):(typeof r=="number"&&Number.isFinite(r)||typeof r=="boolean")&&(t[o]=r,n++))}return t}b.exports={sanitizeContent:le,validateContentLength:me,validateContainerTag:de,sanitizeMetadata:Ee}});var Y=E((qe,j)=>{var{getDb:Te,closeDb:Pe}=X(),{sanitizeContent:$,sanitizeMetadata:fe,validateContainerTag:pe,validateContentLength:_e}=v(),ge="claudecode_default",A=class{constructor(t,n){this.containerTag=t||ge,this.dbPath=n}_getDb(){return Te(this.dbPath)}async addMemory(t,n,o={},r=null){let c=this._getDb(),i=n||this.containerTag;pe(i);let s=$(t);_e(s);let a=fe({sm_source:"claude-code-plugin",...o}),u=a.project||null,d=a.type||"session_turn",m=JSON.stringify(a);if(r){let y=c.prepare("SELECT id FROM memories WHERE custom_id = ?").get(r);if(y)return c.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(s,i,u,d,m,r),{id:y.id,status:"updated",containerTag:i}}return{id:c.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(s,i,u,d,a.session_id||null,r,m).lastInsertRowid,status:"created",containerTag:i}}async search(t,n,o={}){let r=this._getDb(),c=n||this.containerTag,i=o.limit||10,s=$(t).replace(/['"]/g,"").trim();if(!s)return{results:[],total:0};let a=s.split(/\s+/).filter(Boolean).map(u=>`"${u}"`).join(" OR ");try{let u=r.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(a,c,i),d=u.length>0?Math.max(...u.map(l=>Math.abs(l.rank))):1,m=u.map(l=>({id:l.id,memory:l.content,content:l.content,similarity:d>0?Math.abs(l.rank)/d:0,containerTag:l.container_tag,title:l.project_name,createdAt:l.created_at}));return{results:m,total:m.length}}catch{return{results:[],total:0}}}async getProfile(t,n){let o=this._getDb(),r=t||this.containerTag,c=o.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(r).map(a=>a.fact_text),i=o.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(r).map(a=>a.fact_text),s=n?await this.search(n,r,{limit:10}):{results:[],total:0};return{profile:{static:c,dynamic:i},searchResults:s.results.length>0?s:void 0}}async listMemories(t,n=20){let o=this._getDb(),r=t||this.containerTag;return{memories:o.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(r,n)}}async deleteMemory(t){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(t)}};j.exports={LocalMemoryClient:A}});var H=E((Be,k)=>{var{execSync:G}=require("node:child_process"),Ne=require("node:crypto");function N(e){return Ne.createHash("sha256").update(e).digest("hex").slice(0,16)}function I(e){try{return G("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function he(e){let n=I(e)||e;return`claudecode_project_${N(n)}`}function Se(e){return(I(e)||e).split("/").pop()||"unknown"}function ye(){try{let t=G("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${N(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${N(e)}`}k.exports={sha256:N,getGitRoot:I,getContainerTag:he,getProjectName:Se,getUserContainerTag:ye}});var W=E((We,B)=>{var _=require("node:fs"),P=require("node:path"),Re=require("node:os"),h=process.env.LOCAL_MEMORY_DIR||P.join(Re.homedir(),".local-memory"),p=P.join(h,"settings.json"),q={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function Le(){_.existsSync(h)||_.mkdirSync(h,{recursive:!0,mode:448})}function Oe(){let e={...q};try{if(_.existsSync(p)){let t=_.readFileSync(p,"utf-8");e={...e,...JSON.parse(t)}}}catch(t){console.error(`Settings: Failed to load ${p}: ${t.message}`)}return process.env.LOCAL_MEMORY_SKIP_TOOLS&&(e={...e,skipTools:process.env.LOCAL_MEMORY_SKIP_TOOLS.split(",").map(t=>t.trim())}),process.env.LOCAL_MEMORY_DEBUG==="true"&&(e={...e,debug:!0}),e}function Ae(e){Le();let t={...e};_.writeFileSync(p,JSON.stringify(t,null,2),{mode:384})}function Ie(e,t){return t.skipTools.includes(e)?!1:t.captureTools&&t.captureTools.length>0?t.captureTools.includes(e):!0}function Me(e,t,n){if(e.debug){let o=new Date().toISOString();console.error(n?`[${o}] ${t}: ${JSON.stringify(n)}`:`[${o}] ${t}`)}}B.exports={SETTINGS_DIR:h,SETTINGS_FILE:p,DEFAULT_SETTINGS:q,loadSettings:Oe,saveSettings:Ae,shouldCaptureTool:Ie,debugLog:Me}});var z=E((Je,J)=>{async function De(){return new Promise((e,t)=>{let n="";process.stdin.setEncoding("utf8"),process.stdin.on("data",o=>{n+=o}),process.stdin.on("end",()=>{try{e(n.trim()?JSON.parse(n):{})}catch(o){t(new Error(`Failed to parse stdin JSON: ${o.message}`))}}),process.stdin.on("error",t),process.stdin.isTTY&&e({})})}function S(e){console.log(JSON.stringify(e))}function Fe(e=null){S(e?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:e}}:{continue:!0,suppressOutput:!0})}function Ce(e){console.error(`LocalMemory: ${e}`),S({continue:!0,suppressOutput:!0})}J.exports={readStdin:De,writeOutput:S,outputSuccess:Fe,outputError:Ce}});var Q=E((ze,Z)=>{function K(e){try{let t=new Date(e),n=new Date,o=(n.getTime()-t.getTime())/1e3,r=o/60,c=o/3600,i=o/86400;if(r<30)return"just now";if(r<60)return`${Math.floor(r)}mins ago`;if(c<24)return`${Math.floor(c)}hrs ago`;if(i<7)return`${Math.floor(i)}d ago`;let s=t.toLocaleString("en",{month:"short"});return t.getFullYear()===n.getFullYear()?`${t.getDate()} ${s}`:`${t.getDate()} ${s}, ${t.getFullYear()}`}catch{return""}}function V(e,t,n){let o=new Set,r=e.filter(s=>o.has(s)?!1:(o.add(s),!0)),c=t.filter(s=>o.has(s)?!1:(o.add(s),!0)),i=n.filter(s=>{let a=s.memory??"";return!a||o.has(a)?!1:(o.add(a),!0)});return{static:r,dynamic:c,searchResults:i}}function Ue(e,t=!0,n=!1,o=10){if(!e)return null;let r=e.profile?.static||[],c=e.profile?.dynamic||[],i=e.searchResults?.results||[],s=V(t?r:[],t?c:[],n?i:[]),a=s.static.slice(0,o),u=s.dynamic.slice(0,o),d=s.searchResults.slice(0,o);if(a.length===0&&u.length===0&&d.length===0)return null;let m=[];if(a.length>0&&m.push(`## User Profile (Persistent)
`+a.map(g=>`- ${g}`).join(`
`)),u.length>0&&m.push(`## Recent Context
`+u.map(g=>`- ${g}`).join(`
`)),d.length>0){let ee=d.map(f=>{let R=f.memory??"",te=R.length>500?`${R.slice(0,500)}...`:R,F=f.updatedAt?K(f.updatedAt):"",ne=f.similarity!=null?`[${Math.round(f.similarity*100)}%]`:"";return`- ${F?`[${F}] `:""}${te} ${ne}`.trim()});m.push(`## Relevant Memories (with relevance %)
`+ee.join(`
`))}return`<local-memory-context>
The following is recalled context about the user. Reference it only when relevant to the conversation.

${m.join(`

`)}

Use these memories naturally when relevant \u2014 including indirect connections \u2014 but don't force them into every response or make assumptions beyond what's stated.
</local-memory-context>`}Z.exports={formatContext:Ue,formatRelativeTime:K,deduplicateMemories:V}});var{LocalMemoryClient:we}=Y(),{getContainerTag:xe,getProjectName:Xe}=H(),{loadSettings:be,debugLog:M}=W(),{readStdin:ve,writeOutput:D}=z(),{formatContext:$e}=Q();async function je(){let e=be();try{let n=(await ve()).cwd||process.cwd(),o=xe(n),r=Xe(n);M(e,"SessionStart",{cwd:n,containerTag:o,projectName:r});let i=await new we(o).getProfile(o,r).catch(()=>null),s=$e(i,e.injectProfile,!0,e.maxProfileItems);if(!s){D({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:`<local-memory-context>
No previous memories found for this project.
Memories will be saved as you work.
</local-memory-context>`}});return}M(e,"Context generated",{length:s.length}),D({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:s}})}catch(t){M(e,"Error",{error:t.message}),console.error(`LocalMemory: ${t.message}`),D({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:`<local-memory-status>
Failed to load memories. Session will continue without memory context.
</local-memory-status>`}})}}je().catch(e=>{console.error(`LocalMemory fatal: ${e.message}`),process.exit(1)});
