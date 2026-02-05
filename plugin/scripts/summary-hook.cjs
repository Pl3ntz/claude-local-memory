#!/usr/bin/env node
var d=(t,e)=>()=>(e||t((e={exports:{}}).exports,e),e.exports);var h=d((Wt,b)=>{var nt=require("better-sqlite3"),L=require("node:fs"),O=require("node:path"),st=require("node:os"),F=O.join(st.homedir(),".local-memory"),C=O.join(F,"memory.db"),f=null;function rt(t){L.existsSync(t)||L.mkdirSync(t,{recursive:!0,mode:448})}function ot(t=C){if(f)return f;let e=t===":memory:";e||rt(O.dirname(t));let n=new nt(t);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),w(n),!e)try{L.chmodSync(t,384)}catch{}return f=n,n}function w(t){t.exec(`
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
  `),it(t)}function it(t){t.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||t.exec(`
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
  `)}function at(){f&&(f.close(),f=null)}b.exports={getDb:ot,closeDb:at,runMigrations:w,DEFAULT_DB_PATH:C,DEFAULT_DB_DIR:F}});var X=d((Jt,x)=>{var ct=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function ut(t,e=1e5){if(!t||typeof t!="string")return"";let n=t;for(let s of ct)n=n.replace(s,"");return n.length>e&&(n=n.slice(0,e)),n}function lt(t,e=1,n=1e5){return t.length<e?{valid:!1,reason:`content below minimum length (${e})`}:t.length>n?{valid:!1,reason:`content exceeds maximum length (${n})`}:{valid:!0}}function mt(t){return!t||typeof t!="string"?{valid:!1,reason:"tag is empty"}:t.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(t)?/^[-_]|[-_]$/.test(t)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function dt(t){if(!t||typeof t!="object")return{};let e={},n=0;for(let[s,r]of Object.entries(t)){if(n>=50)break;s.length>128||/[^\w.-]/.test(s)||(typeof r=="string"?(e[s]=r.slice(0,1024),n++):(typeof r=="number"&&Number.isFinite(r)||typeof r=="boolean")&&(e[s]=r,n++))}return e}x.exports={sanitizeContent:ut,validateContentLength:lt,validateContainerTag:mt,sanitizeMetadata:dt}});var v=d((Vt,$)=>{var{getDb:ft,closeDb:Kt}=h(),{sanitizeContent:j,sanitizeMetadata:Et,validateContainerTag:pt,validateContentLength:Tt}=X(),_t="claudecode_default",A=class{constructor(e,n){this.containerTag=e||_t,this.dbPath=n}_getDb(){return ft(this.dbPath)}async addMemory(e,n,s={},r=null){let a=this._getDb(),o=n||this.containerTag;pt(o);let i=j(e);Tt(i);let c=Et({sm_source:"claude-code-plugin",...s}),u=c.project||null,m=c.type||"session_turn",E=JSON.stringify(c);if(r){let U=a.prepare("SELECT id FROM memories WHERE custom_id = ?").get(r);if(U)return a.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(i,o,u,m,E,r),{id:U.id,status:"updated",containerTag:o}}return{id:a.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(i,o,u,m,c.session_id||null,r,E).lastInsertRowid,status:"created",containerTag:o}}async search(e,n,s={}){let r=this._getDb(),a=n||this.containerTag,o=s.limit||10,i=j(e).replace(/['"]/g,"").trim();if(!i)return{results:[],total:0};let c=i.split(/\s+/).filter(Boolean).map(u=>`"${u}"`).join(" OR ");try{let u=r.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(c,a,o),m=u.length>0?Math.max(...u.map(l=>Math.abs(l.rank))):1,E=u.map(l=>({id:l.id,memory:l.content,content:l.content,similarity:m>0?Math.abs(l.rank)/m:0,containerTag:l.container_tag,title:l.project_name,createdAt:l.created_at}));return{results:E,total:E.length}}catch{return{results:[],total:0}}}async getProfile(e,n){let s=this._getDb(),r=e||this.containerTag,a=s.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(r).map(c=>c.fact_text),o=s.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(r).map(c=>c.fact_text),i=n?await this.search(n,r,{limit:10}):{results:[],total:0};return{profile:{static:a,dynamic:o},searchResults:i.results.length>0?i:void 0}}async listMemories(e,n=20){let s=this._getDb(),r=e||this.containerTag;return{memories:s.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(r,n)}}async deleteMemory(e){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(e)}};$.exports={LocalMemoryClient:A}});var k=d((zt,G)=>{var{execSync:H}=require("node:child_process"),gt=require("node:crypto");function N(t){return gt.createHash("sha256").update(t).digest("hex").slice(0,16)}function I(t){try{return H("git rev-parse --show-toplevel",{cwd:t,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function Nt(t){let n=I(t)||t;return`claudecode_project_${N(n)}`}function St(t){return(I(t)||t).split("/").pop()||"unknown"}function yt(){try{let e=H("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(e)return`claudecode_user_${N(e)}`}catch{}let t=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${N(t)}`}G.exports={sha256:N,getGitRoot:I,getContainerTag:Nt,getProjectName:St,getUserContainerTag:yt}});var B=d((Zt,q)=>{var T=require("node:fs"),Y=require("node:path"),Rt=require("node:os"),S=process.env.LOCAL_MEMORY_DIR||Y.join(Rt.homedir(),".local-memory"),p=Y.join(S,"settings.json"),P={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function Lt(){T.existsSync(S)||T.mkdirSync(S,{recursive:!0,mode:448})}function Ot(){let t={...P};try{if(T.existsSync(p)){let e=T.readFileSync(p,"utf-8");t={...t,...JSON.parse(e)}}}catch(e){console.error(`Settings: Failed to load ${p}: ${e.message}`)}return process.env.LOCAL_MEMORY_SKIP_TOOLS&&(t={...t,skipTools:process.env.LOCAL_MEMORY_SKIP_TOOLS.split(",").map(e=>e.trim())}),process.env.LOCAL_MEMORY_DEBUG==="true"&&(t={...t,debug:!0}),t}function ht(t){Lt();let e={...t};T.writeFileSync(p,JSON.stringify(e,null,2),{mode:384})}function At(t,e){return e.skipTools.includes(t)?!1:e.captureTools&&e.captureTools.length>0?e.captureTools.includes(t):!0}function It(t,e,n){if(t.debug){let s=new Date().toISOString();console.error(n?`[${s}] ${e}: ${JSON.stringify(n)}`:`[${s}] ${e}`)}}q.exports={SETTINGS_DIR:S,SETTINGS_FILE:p,DEFAULT_SETTINGS:P,loadSettings:Ot,saveSettings:ht,shouldCaptureTool:At,debugLog:It}});var J=d((Qt,W)=>{async function Dt(){return new Promise((t,e)=>{let n="";process.stdin.setEncoding("utf8"),process.stdin.on("data",s=>{n+=s}),process.stdin.on("end",()=>{try{t(n.trim()?JSON.parse(n):{})}catch(s){e(new Error(`Failed to parse stdin JSON: ${s.message}`))}}),process.stdin.on("error",e),process.stdin.isTTY&&t({})})}function y(t){console.log(JSON.stringify(t))}function Mt(t=null){y(t?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:t}}:{continue:!0,suppressOutput:!0})}function Ut(t){console.error(`LocalMemory: ${t}`),y({continue:!0,suppressOutput:!0})}W.exports={readStdin:Dt,writeOutput:y,outputSuccess:Mt,outputError:Ut}});var tt=d((te,Q)=>{var K=require("node:fs"),Ft=500,Ct=["Read"],D=new Map;function V(t){if(!K.existsSync(t))return[];let n=K.readFileSync(t,"utf-8").trim().split(`
`),s=[];for(let r of n)if(r.trim())try{s.push(JSON.parse(r))}catch{}return s}function z(t,e){if(!e)return t.filter(r=>r.type==="user"||r.type==="assistant");let n=!1,s=[];for(let r of t){if(r.uuid===e){n=!0;continue}n&&(r.type==="user"||r.type==="assistant")&&s.push(r)}return s}function Z(t){let e=[];if(t.type==="user"){let n=wt(t.message);n&&e.push(n)}else if(t.type==="assistant"){let n=bt(t.message);n&&e.push(n)}return e.join(`
`)}function wt(t){if(!t?.content)return null;let e=t.content,n=[];if(typeof e=="string"){let s=_(e);s&&n.push(`[role:user]
${s}
[user:end]`)}else if(Array.isArray(e)){for(let s of e)if(s.type==="text"&&s.text){let r=_(s.text);r&&n.push(`[role:user]
${r}
[user:end]`)}else if(s.type==="tool_result"){let r=s.tool_use_id||"",a=D.get(r)||"Unknown";if(Ct.includes(a))continue;let o=M(_(s.content||""),Ft),i=s.is_error?"error":"success";o&&n.push(`[tool_result:${a} status="${i}"]
${o}
[tool_result:end]`)}}return n.length>0?n.join(`

`):null}function bt(t){if(!t?.content)return null;let e=t.content,n=[];if(!Array.isArray(e))return null;for(let s of e)if(s.type!=="thinking"){if(s.type==="text"&&s.text){let r=_(s.text);r&&n.push(`[role:assistant]
${r}
[assistant:end]`)}else if(s.type==="tool_use"){let r=s.name||"Unknown",a=s.id||"",o=s.input||{},i=xt(o);n.push(`[tool:${r}]
${i}
[tool:end]`),a&&D.set(a,r)}}return n.length>0?n.join(`

`):null}function xt(t){let e=[];for(let[n,s]of Object.entries(t)){let r=typeof s=="string"?s:JSON.stringify(s);r=M(r,200),e.push(`${n}: ${r}`)}return e.join(`
`)}function _(t){return!t||typeof t!="string"?"":t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").replace(/<local-memory-context>[\s\S]*?<\/local-memory-context>/g,"").replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>/g,"").trim()}function M(t,e){return!t||t.length<=e?t:`${t.slice(0,e)}...`}function Xt(t,e){D=new Map;let n=V(t);if(n.length===0)return null;let s=z(n,e);if(s.length===0)return null;let r=s[0],a=s[s.length-1],o=r.timestamp||new Date().toISOString(),i=[];i.push(`[turn:start timestamp="${o}"]`);for(let u of s){let m=Z(u);m&&i.push(m)}i.push("[turn:end]");let c=i.join(`

`);return c.length<100?null:{formatted:c,lastUuid:a.uuid}}Q.exports={parseTranscript:V,getEntriesSinceLastCapture:z,formatEntry:Z,formatNewEntries:Xt,cleanContent:_,truncate:M}});var{LocalMemoryClient:jt}=v(),{getContainerTag:$t,getProjectName:vt}=k(),{loadSettings:Ht,debugLog:g}=B(),{readStdin:Gt,writeOutput:R}=J(),{formatNewEntries:kt}=tt(),{getDb:et}=h();function Yt(t){let n=et().prepare("SELECT last_captured_uuid FROM sessions WHERE session_id = ?").get(t);return n?n.last_captured_uuid:null}function Pt(t,e,n,s){let r=et();r.prepare("SELECT id FROM sessions WHERE session_id = ?").get(t)?r.prepare(`UPDATE sessions SET last_captured_uuid = ?, ended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE session_id = ?`).run(e,t):r.prepare(`INSERT INTO sessions (session_id, container_tag, project_name, last_captured_uuid)
       VALUES (?, ?, ?, ?)`).run(t,n,s,e)}async function qt(){let t=Ht();try{let e=await Gt(),n=e.cwd||process.cwd(),s=e.session_id,r=e.transcript_path;if(g(t,"Stop",{sessionId:s,transcriptPath:r}),!r||!s){g(t,"Missing transcript path or session id"),R({continue:!0});return}let a=Yt(s),o=kt(r,a);if(!o){g(t,"No new content to save"),R({continue:!0});return}let i=new jt,c=$t(n),u=vt(n);await i.addMemory(o.formatted,c,{type:"session_turn",project:u,timestamp:new Date().toISOString()},s),Pt(s,o.lastUuid,c,u),g(t,"Session turn saved",{length:o.formatted.length}),R({continue:!0})}catch(e){g(t,"Error",{error:e.message}),console.error(`LocalMemory: ${e.message}`),R({continue:!0})}}qt().catch(t=>{console.error(`LocalMemory fatal: ${t.message}`),process.exit(1)});
