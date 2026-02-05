#!/usr/bin/env node
var E=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var w=E((je,x)=>{var te=require("better-sqlite3"),R=require("node:fs"),L=require("node:path"),ne=require("node:os"),F=L.join(ne.homedir(),".local-memory"),U=L.join(F,"memory.db"),T=null;function oe(e){R.existsSync(e)||R.mkdirSync(e,{recursive:!0,mode:448})}function re(e=U){if(T)return T;let t=e===":memory:";t||oe(L.dirname(e));let n=new te(e);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),C(n),!t)try{R.chmodSync(e,384)}catch{}return T=n,n}function C(e){e.exec(`
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
  `),se(e)}function se(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function ie(){T&&(T.close(),T=null)}x.exports={getDb:re,closeDb:ie,runMigrations:C,DEFAULT_DB_PATH:U,DEFAULT_DB_DIR:F}});var X=E((ve,b)=>{var ae=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function ce(e,t=1e5){if(!e||typeof e!="string")return"";let n=e;for(let o of ae)n=n.replace(o,"");return n.length>t&&(n=n.slice(0,t)),n}function ue(e,t=1,n=1e5){return e.length<t?{valid:!1,reason:`content below minimum length (${t})`}:e.length>n?{valid:!1,reason:`content exceeds maximum length (${n})`}:{valid:!0}}function me(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function le(e){if(!e||typeof e!="object")return{};let t={},n=0;for(let[o,r]of Object.entries(e)){if(n>=50)break;o.length>128||/[^\w.-]/.test(o)||(typeof r=="string"?(t[o]=r.slice(0,1024),n++):(typeof r=="number"&&Number.isFinite(r)||typeof r=="boolean")&&(t[o]=r,n++))}return t}b.exports={sanitizeContent:ce,validateContentLength:ue,validateContainerTag:me,sanitizeMetadata:le}});var v=E((Ye,j)=>{var{getDb:de,closeDb:ke}=w(),{sanitizeContent:$,sanitizeMetadata:Ee}=X(),Te="claudecode_default",O=class{constructor(t,n){this.containerTag=t||Te,this.dbPath=n}_getDb(){return de(this.dbPath)}async addMemory(t,n,o={},r=null){let c=this._getDb(),a=n||this.containerTag,s=$(t),i=Ee({sm_source:"claude-code-plugin",...o}),u=i.project||null,d=i.type||"session_turn",l=JSON.stringify(i);if(r){let y=c.prepare("SELECT id FROM memories WHERE custom_id = ?").get(r);if(y)return c.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(s,a,u,d,l,r),{id:y.id,status:"updated",containerTag:a}}return{id:c.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(s,a,u,d,i.session_id||null,r,l).lastInsertRowid,status:"created",containerTag:a}}async search(t,n,o={}){let r=this._getDb(),c=n||this.containerTag,a=o.limit||10,s=$(t).replace(/['"]/g,"").trim();if(!s)return{results:[],total:0};let i=s.split(/\s+/).filter(Boolean).map(u=>`"${u}"`).join(" OR ");try{let u=r.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(i,c,a),d=u.length>0?Math.max(...u.map(m=>Math.abs(m.rank))):1,l=u.map(m=>({id:m.id,memory:m.content,content:m.content,similarity:d>0?Math.abs(m.rank)/d:0,containerTag:m.container_tag,title:m.project_name,createdAt:m.created_at}));return{results:l,total:l.length}}catch{return{results:[],total:0}}}async getProfile(t,n){let o=this._getDb(),r=t||this.containerTag,c=o.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(r).map(i=>i.fact_text),a=o.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(r).map(i=>i.fact_text),s=n?await this.search(n,r,{limit:10}):{results:[],total:0};return{profile:{static:c,dynamic:a},searchResults:s.results.length>0?s:void 0}}async listMemories(t,n=20){let o=this._getDb(),r=t||this.containerTag;return{memories:o.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(r,n)}}async deleteMemory(t){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(t)}};j.exports={LocalMemoryClient:O}});var G=E((Ge,Y)=>{var{execSync:k}=require("node:child_process"),fe=require("node:crypto");function N(e){return fe.createHash("sha256").update(e).digest("hex").slice(0,16)}function A(e){try{return k("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function pe(e){let n=A(e)||e;return`claudecode_project_${N(n)}`}function _e(e){return(A(e)||e).split("/").pop()||"unknown"}function ge(){try{let t=k("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${N(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${N(e)}`}Y.exports={sha256:N,getGitRoot:A,getContainerTag:pe,getProjectName:_e,getUserContainerTag:ge}});var B=E((He,q)=>{var g=require("node:fs"),H=require("node:path"),Ne=require("node:os"),h=process.env.LOCAL_MEMORY_DIR||H.join(Ne.homedir(),".local-memory"),_=H.join(h,"settings.json"),P={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function he(){g.existsSync(h)||g.mkdirSync(h,{recursive:!0,mode:448})}function Se(){let e={...P};try{if(g.existsSync(_)){let t=g.readFileSync(_,"utf-8");Object.assign(e,JSON.parse(t))}}catch(t){console.error(`Settings: Failed to load ${_}: ${t.message}`)}return process.env.LOCAL_MEMORY_SKIP_TOOLS&&(e.skipTools=process.env.LOCAL_MEMORY_SKIP_TOOLS.split(",").map(t=>t.trim())),process.env.LOCAL_MEMORY_DEBUG==="true"&&(e.debug=!0),e}function ye(e){he();let t={...e};g.writeFileSync(_,JSON.stringify(t,null,2))}function Re(e,t){return t.skipTools.includes(e)?!1:t.captureTools&&t.captureTools.length>0?t.captureTools.includes(e):!0}function Le(e,t,n){if(e.debug){let o=new Date().toISOString();console.error(n?`[${o}] ${t}: ${JSON.stringify(n)}`:`[${o}] ${t}`)}}q.exports={SETTINGS_DIR:h,SETTINGS_FILE:_,DEFAULT_SETTINGS:P,loadSettings:Se,saveSettings:ye,shouldCaptureTool:Re,debugLog:Le}});var J=E((Pe,W)=>{async function Oe(){return new Promise((e,t)=>{let n="";process.stdin.setEncoding("utf8"),process.stdin.on("data",o=>{n+=o}),process.stdin.on("end",()=>{try{e(n.trim()?JSON.parse(n):{})}catch(o){t(new Error(`Failed to parse stdin JSON: ${o.message}`))}}),process.stdin.on("error",t),process.stdin.isTTY&&e({})})}function S(e){console.log(JSON.stringify(e))}function Ae(e=null){S(e?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:e}}:{continue:!0,suppressOutput:!0})}function Ie(e){console.error(`LocalMemory: ${e}`),S({continue:!0,suppressOutput:!0})}W.exports={readStdin:Oe,writeOutput:S,outputSuccess:Ae,outputError:Ie}});var Z=E((qe,V)=>{function z(e){try{let t=new Date(e),n=new Date,o=(n.getTime()-t.getTime())/1e3,r=o/60,c=o/3600,a=o/86400;if(r<30)return"just now";if(r<60)return`${Math.floor(r)}mins ago`;if(c<24)return`${Math.floor(c)}hrs ago`;if(a<7)return`${Math.floor(a)}d ago`;let s=t.toLocaleString("en",{month:"short"});return t.getFullYear()===n.getFullYear()?`${t.getDate()} ${s}`:`${t.getDate()} ${s}, ${t.getFullYear()}`}catch{return""}}function K(e,t,n){let o=new Set,r=e.filter(s=>o.has(s)?!1:(o.add(s),!0)),c=t.filter(s=>o.has(s)?!1:(o.add(s),!0)),a=n.filter(s=>{let i=s.memory??"";return!i||o.has(i)?!1:(o.add(i),!0)});return{static:r,dynamic:c,searchResults:a}}function De(e,t=!0,n=!1,o=10){if(!e)return null;let r=e.profile?.static||[],c=e.profile?.dynamic||[],a=e.searchResults?.results||[],s=K(t?r:[],t?c:[],n?a:[]),i=s.static.slice(0,o),u=s.dynamic.slice(0,o),d=s.searchResults.slice(0,o);if(i.length===0&&u.length===0&&d.length===0)return null;let l=[];if(i.length>0&&l.push(`## User Profile (Persistent)
`+i.map(f=>`- ${f}`).join(`
`)),u.length>0&&l.push(`## Recent Context
`+u.map(f=>`- ${f}`).join(`
`)),d.length>0){let f=d.map(p=>{let Q=p.memory??"",M=p.updatedAt?z(p.updatedAt):"",ee=p.similarity!=null?`[${Math.round(p.similarity*100)}%]`:"";return`- ${M?`[${M}] `:""}${Q} ${ee}`.trim()});l.push(`## Relevant Memories (with relevance %)
`+f.join(`
`))}return`<local-memory-context>
The following is recalled context about the user. Reference it only when relevant to the conversation.

${l.join(`

`)}

Use these memories naturally when relevant \u2014 including indirect connections \u2014 but don't force them into every response or make assumptions beyond what's stated.
</local-memory-context>`}V.exports={formatContext:De,formatRelativeTime:z,deduplicateMemories:K}});var{LocalMemoryClient:Me}=v(),{getContainerTag:Fe,getProjectName:Ue}=G(),{loadSettings:Ce,debugLog:I}=B(),{readStdin:xe,writeOutput:D}=J(),{formatContext:we}=Z();async function be(){let e=Ce();try{let n=(await xe()).cwd||process.cwd(),o=Fe(n),r=Ue(n);I(e,"SessionStart",{cwd:n,containerTag:o,projectName:r});let a=await new Me(o).getProfile(o,r).catch(()=>null),s=we(a,!0,!1,e.maxProfileItems);if(!s){D({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:`<local-memory-context>
No previous memories found for this project.
Memories will be saved as you work.
</local-memory-context>`}});return}I(e,"Context generated",{length:s.length}),D({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:s}})}catch(t){I(e,"Error",{error:t.message}),console.error(`LocalMemory: ${t.message}`),D({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:`<local-memory-status>
Failed to load memories: ${t.message}
Session will continue without memory context.
</local-memory-status>`}})}}be().catch(e=>{console.error(`LocalMemory fatal: ${e.message}`),process.exit(1)});
