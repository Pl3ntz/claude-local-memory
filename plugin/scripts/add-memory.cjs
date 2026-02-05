#!/usr/bin/env node
var _=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var O=_((oe,I)=>{var j=require("better-sqlite3"),p=require("node:fs"),f=require("node:path"),x=require("node:os"),L=f.join(x.homedir(),".local-memory"),A=f.join(L,"memory.db"),T=null;function b(e){p.existsSync(e)||p.mkdirSync(e,{recursive:!0,mode:448})}function w(e=A){if(T)return T;let t=e===":memory:";t||b(f.dirname(e));let n=new j(e);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),y(n),!t)try{p.chmodSync(e,384)}catch{}return T=n,n}function y(e){e.exec(`
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
  `)}function v(){T&&(T.close(),T=null)}I.exports={getDb:w,closeDb:v,runMigrations:y,DEFAULT_DB_PATH:A,DEFAULT_DB_DIR:L}});var S=_((re,D)=>{var G=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function Y(e,t=1e5){if(!e||typeof e!="string")return"";let n=e;for(let r of G)n=n.replace(r,"");return n.length>t&&(n=n.slice(0,t)),n}function B(e,t=1,n=1e5){return e.length<t?{valid:!1,reason:`content below minimum length (${t})`}:e.length>n?{valid:!1,reason:`content exceeds maximum length (${n})`}:{valid:!0}}function P(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function $(e){if(!e||typeof e!="object")return{};let t={},n=0;for(let[r,o]of Object.entries(e)){if(n>=50)break;r.length>128||/[^\w.-]/.test(r)||(typeof o=="string"?(t[r]=o.slice(0,1024),n++):(typeof o=="number"&&Number.isFinite(o)||typeof o=="boolean")&&(t[r]=o,n++))}return t}D.exports={sanitizeContent:Y,validateContentLength:B,validateContainerTag:P,sanitizeMetadata:$}});var F=_((ie,U)=>{var{getDb:k,closeDb:se}=O(),{sanitizeContent:h,sanitizeMetadata:q}=S(),W="claudecode_default",g=class{constructor(t,n){this.containerTag=t||W,this.dbPath=n}_getDb(){return k(this.dbPath)}async addMemory(t,n,r={},o=null){let s=this._getDb(),c=n||this.containerTag,E=h(t),i=q({sm_source:"claude-code-plugin",...r}),m=i.project||null,d=i.type||"session_turn",l=JSON.stringify(i);if(o){let R=s.prepare("SELECT id FROM memories WHERE custom_id = ?").get(o);if(R)return s.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(E,c,m,d,l,o),{id:R.id,status:"updated",containerTag:c}}return{id:s.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(E,c,m,d,i.session_id||null,o,l).lastInsertRowid,status:"created",containerTag:c}}async search(t,n,r={}){let o=this._getDb(),s=n||this.containerTag,c=r.limit||10,E=h(t).replace(/['"]/g,"").trim();if(!E)return{results:[],total:0};let i=E.split(/\s+/).filter(Boolean).map(m=>`"${m}"`).join(" OR ");try{let m=o.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(i,s,c),d=m.length>0?Math.max(...m.map(a=>Math.abs(a.rank))):1,l=m.map(a=>({id:a.id,memory:a.content,content:a.content,similarity:d>0?Math.abs(a.rank)/d:0,containerTag:a.container_tag,title:a.project_name,createdAt:a.created_at}));return{results:l,total:l.length}}catch{return{results:[],total:0}}}async getProfile(t,n){let r=this._getDb(),o=t||this.containerTag,s=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(o).map(i=>i.fact_text),c=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(o).map(i=>i.fact_text),E=n?await this.search(n,o,{limit:10}):{results:[],total:0};return{profile:{static:s,dynamic:c},searchResults:E.results.length>0?E:void 0}}async listMemories(t,n=20){let r=this._getDb(),o=t||this.containerTag;return{memories:r.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(o,n)}}async deleteMemory(t){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(t)}};U.exports={LocalMemoryClient:g}});var X=_((ae,C)=>{var{execSync:M}=require("node:child_process"),z=require("node:crypto");function u(e){return z.createHash("sha256").update(e).digest("hex").slice(0,16)}function N(e){try{return M("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function V(e){let n=N(e)||e;return`claudecode_project_${u(n)}`}function Z(e){return(N(e)||e).split("/").pop()||"unknown"}function K(){try{let t=M("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${u(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${u(e)}`}C.exports={sha256:u,getGitRoot:N,getContainerTag:V,getProjectName:Z,getUserContainerTag:K}});var{LocalMemoryClient:Q}=F(),{getContainerTag:J,getProjectName:ee}=X();async function te(){let e=process.argv.slice(2).join(" ");if(!e||!e.trim()){console.log('No content provided. Usage: node add-memory.cjs "content to save"');return}let t=process.cwd(),n=J(t),r=ee(t);try{let s=await new Q(n).addMemory(e,n,{type:"manual",project:r,timestamp:new Date().toISOString()});console.log(`Memory saved to project: ${r}`),console.log(`ID: ${s.id}`)}catch(o){console.log(`Error saving memory: ${o.message}`)}}te().catch(e=>{console.error(`Fatal error: ${e.message}`),process.exit(1)});
