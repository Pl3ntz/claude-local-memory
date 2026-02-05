#!/usr/bin/env node
var u=(e,n)=>()=>(n||e((n={exports:{}}).exports,n),n.exports);var g=u((ae,O)=>{var j=require("better-sqlite3"),p=require("node:fs"),f=require("node:path"),b=require("node:os"),A=f.join(b.homedir(),".local-memory"),y=f.join(A,"memory.db"),T=null;function w(e){p.existsSync(e)||p.mkdirSync(e,{recursive:!0,mode:448})}function x(e=y){if(T)return T;let n=e===":memory:";n||w(f.dirname(e));let t=new j(e);if(t.pragma("journal_mode = WAL"),t.pragma("foreign_keys = ON"),I(t),!n)try{p.chmodSync(e,384)}catch{}return T=t,t}function I(e){e.exec(`
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
  `),H(e)}function H(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function v(){T&&(T.close(),T=null)}O.exports={getDb:x,closeDb:v,runMigrations:I,DEFAULT_DB_PATH:y,DEFAULT_DB_DIR:A}});var h=u((ce,D)=>{var G=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function Y(e,n=1e5){if(!e||typeof e!="string")return"";let t=e;for(let r of G)t=t.replace(r,"");return t.length>n&&(t=t.slice(0,n)),t}function B(e,n=1,t=1e5){return e.length<n?{valid:!1,reason:`content below minimum length (${n})`}:e.length>t?{valid:!1,reason:`content exceeds maximum length (${t})`}:{valid:!0}}function $(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function P(e){if(!e||typeof e!="object")return{};let n={},t=0;for(let[r,o]of Object.entries(e)){if(t>=50)break;r.length>128||/[^\w.-]/.test(r)||(typeof o=="string"?(n[r]=o.slice(0,1024),t++):(typeof o=="number"&&Number.isFinite(o)||typeof o=="boolean")&&(n[r]=o,t++))}return n}D.exports={sanitizeContent:Y,validateContentLength:B,validateContainerTag:$,sanitizeMetadata:P}});var U=u((me,F)=>{var{getDb:k,closeDb:Ee}=g(),{sanitizeContent:S,sanitizeMetadata:W,validateContainerTag:q,validateContentLength:z}=h(),V="claudecode_default",N=class{constructor(n,t){this.containerTag=n||V,this.dbPath=t}_getDb(){return k(this.dbPath)}async addMemory(n,t,r={},o=null){let s=this._getDb(),i=t||this.containerTag;q(i);let E=S(n);z(E);let a=W({sm_source:"claude-code-plugin",...r}),m=a.project||null,d=a.type||"session_turn",l=JSON.stringify(a);if(o){let L=s.prepare("SELECT id FROM memories WHERE custom_id = ?").get(o);if(L)return s.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(E,i,m,d,l,o),{id:L.id,status:"updated",containerTag:i}}return{id:s.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(E,i,m,d,a.session_id||null,o,l).lastInsertRowid,status:"created",containerTag:i}}async search(n,t,r={}){let o=this._getDb(),s=t||this.containerTag,i=r.limit||10,E=S(n).replace(/['"]/g,"").trim();if(!E)return{results:[],total:0};let a=E.split(/\s+/).filter(Boolean).map(m=>`"${m}"`).join(" OR ");try{let m=o.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(a,s,i),d=m.length>0?Math.max(...m.map(c=>Math.abs(c.rank))):1,l=m.map(c=>({id:c.id,memory:c.content,content:c.content,similarity:d>0?Math.abs(c.rank)/d:0,containerTag:c.container_tag,title:c.project_name,createdAt:c.created_at}));return{results:l,total:l.length}}catch{return{results:[],total:0}}}async getProfile(n,t){let r=this._getDb(),o=n||this.containerTag,s=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(o).map(a=>a.fact_text),i=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(o).map(a=>a.fact_text),E=t?await this.search(t,o,{limit:10}):{results:[],total:0};return{profile:{static:s,dynamic:i},searchResults:E.results.length>0?E:void 0}}async listMemories(n,t=20){let r=this._getDb(),o=n||this.containerTag;return{memories:r.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(o,t)}}async deleteMemory(n){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(n)}};F.exports={LocalMemoryClient:N}});var X=u((Te,C)=>{var{execSync:M}=require("node:child_process"),Z=require("node:crypto");function _(e){return Z.createHash("sha256").update(e).digest("hex").slice(0,16)}function R(e){try{return M("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function K(e){let t=R(e)||e;return`claudecode_project_${_(t)}`}function Q(e){return(R(e)||e).split("/").pop()||"unknown"}function J(){try{let n=M("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(n)return`claudecode_user_${_(n)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${_(e)}`}C.exports={sha256:_,getGitRoot:R,getContainerTag:K,getProjectName:Q,getUserContainerTag:J}});var{LocalMemoryClient:ee}=U(),{getContainerTag:te,getProjectName:ne}=X(),{getDb:oe}=g();async function re(e,n){let t=oe(),r=t.prepare("DELETE FROM memories WHERE container_tag = ?").run(e);t.prepare("DELETE FROM profile_facts WHERE container_tag = ?").run(e),t.prepare("DELETE FROM sessions WHERE container_tag = ?").run(e),console.log(`Cleared ${r.changes} memories for project: ${n}`),console.log("New memories will be saved as you continue working.")}async function se(){let e=process.argv.slice(2),n=process.cwd(),t=te(n),r=ne(n);if(e[0]==="--clear-project")return re(t,r);let o=e.join(" ");if(!o||!o.trim()){console.log('No content provided. Usage: node add-memory.cjs "content to save"');return}try{let i=await new ee(t).addMemory(o,t,{type:"manual",project:r,timestamp:new Date().toISOString()});console.log(`Memory saved to project: ${r}`),console.log(`ID: ${i.id}`)}catch(s){console.error(`Error saving memory: ${s.message}`)}}se().catch(e=>{console.error(`Fatal error: ${e.message}`),process.exit(1)});
