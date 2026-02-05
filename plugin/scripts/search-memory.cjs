#!/usr/bin/env node
var d=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var I=d((ne,A)=>{var x=require("better-sqlite3"),f=require("node:fs"),g=require("node:path"),j=require("node:os"),y=g.join(j.homedir(),".local-memory"),h=g.join(y,"memory.db"),T=null;function w(e){f.existsSync(e)||f.mkdirSync(e,{recursive:!0,mode:448})}function b(e=h){if(T)return T;let t=e===":memory:";t||w(g.dirname(e));let o=new x(e);if(o.pragma("journal_mode = WAL"),o.pragma("foreign_keys = ON"),L(o),!t)try{f.chmodSync(e,384)}catch{}return T=o,o}function L(e){e.exec(`
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
  `)}function v(){T&&(T.close(),T=null)}A.exports={getDb:b,closeDb:v,runMigrations:L,DEFAULT_DB_PATH:h,DEFAULT_DB_DIR:y}});var D=d((re,O)=>{var $=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function G(e,t=1e5){if(!e||typeof e!="string")return"";let o=e;for(let s of $)o=o.replace(s,"");return o.length>t&&(o=o.slice(0,t)),o}function Y(e,t=1,o=1e5){return e.length<t?{valid:!1,reason:`content below minimum length (${t})`}:e.length>o?{valid:!1,reason:`content exceeds maximum length (${o})`}:{valid:!0}}function P(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function B(e){if(!e||typeof e!="object")return{};let t={},o=0;for(let[s,n]of Object.entries(e)){if(o>=50)break;s.length>128||/[^\w.-]/.test(s)||(typeof n=="string"?(t[s]=n.slice(0,1024),o++):(typeof n=="number"&&Number.isFinite(n)||typeof n=="boolean")&&(t[s]=n,o++))}return t}O.exports={sanitizeContent:G,validateContentLength:Y,validateContainerTag:P,sanitizeMetadata:B}});var U=d((ie,M)=>{var{getDb:q,closeDb:se}=I(),{sanitizeContent:S,sanitizeMetadata:k}=D(),W="claudecode_default",p=class{constructor(t,o){this.containerTag=t||W,this.dbPath=o}_getDb(){return q(this.dbPath)}async addMemory(t,o,s={},n=null){let i=this._getDb(),r=o||this.containerTag,a=S(t),c=k({sm_source:"claude-code-plugin",...s}),l=c.project||null,m=c.type||"session_turn",u=JSON.stringify(c);if(n){let R=i.prepare("SELECT id FROM memories WHERE custom_id = ?").get(n);if(R)return i.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(a,r,l,m,u,n),{id:R.id,status:"updated",containerTag:r}}return{id:i.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(a,r,l,m,c.session_id||null,n,u).lastInsertRowid,status:"created",containerTag:r}}async search(t,o,s={}){let n=this._getDb(),i=o||this.containerTag,r=s.limit||10,a=S(t).replace(/['"]/g,"").trim();if(!a)return{results:[],total:0};let c=a.split(/\s+/).filter(Boolean).map(l=>`"${l}"`).join(" OR ");try{let l=n.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(c,i,r),m=l.length>0?Math.max(...l.map(E=>Math.abs(E.rank))):1,u=l.map(E=>({id:E.id,memory:E.content,content:E.content,similarity:m>0?Math.abs(E.rank)/m:0,containerTag:E.container_tag,title:E.project_name,createdAt:E.created_at}));return{results:u,total:u.length}}catch{return{results:[],total:0}}}async getProfile(t,o){let s=this._getDb(),n=t||this.containerTag,i=s.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(n).map(c=>c.fact_text),r=s.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(n).map(c=>c.fact_text),a=o?await this.search(o,n,{limit:10}):{results:[],total:0};return{profile:{static:i,dynamic:r},searchResults:a.results.length>0?a:void 0}}async listMemories(t,o=20){let s=this._getDb(),n=t||this.containerTag;return{memories:s.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(n,o)}}async deleteMemory(t){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(t)}};M.exports={LocalMemoryClient:p}});var X=d((ae,C)=>{var{execSync:F}=require("node:child_process"),z=require("node:crypto");function _(e){return z.createHash("sha256").update(e).digest("hex").slice(0,16)}function N(e){try{return F("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function V(e){let o=N(e)||e;return`claudecode_project_${_(o)}`}function Z(e){return(N(e)||e).split("/").pop()||"unknown"}function K(){try{let t=F("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${_(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${_(e)}`}C.exports={sha256:_,getGitRoot:N,getContainerTag:V,getProjectName:Z,getUserContainerTag:K}});var{LocalMemoryClient:Q}=U(),{getContainerTag:J,getProjectName:ee}=X();async function te(){let e=process.argv.slice(2).join(" ");if(!e||!e.trim()){console.log("No search query provided. Please specify what you want to search for.");return}let t=process.cwd(),o=J(t),s=ee(t);try{let n=new Q(o),i=await n.getProfile(o,e);if(console.log(`## Memory Search: "${e}"`),console.log(`Project: ${s}
`),i.profile&&(i.profile.static?.length>0&&(console.log("### User Preferences"),i.profile.static.forEach(r=>console.log(`- ${r}`)),console.log("")),i.profile.dynamic?.length>0&&(console.log("### Recent Context"),i.profile.dynamic.forEach(r=>console.log(`- ${r}`)),console.log(""))),i.searchResults?.results?.length>0)console.log("### Relevant Memories"),i.searchResults.results.forEach((r,a)=>{let c=Math.round(r.similarity*100),l=r.memory||r.content||"";console.log(`
**Memory ${a+1}** (${c}% match)`),r.title&&console.log(`*${r.title}*`),console.log(l.slice(0,500))});else{let r=await n.search(e,o,{limit:10});r.results?.length>0?(console.log("### Relevant Memories"),r.results.forEach((a,c)=>{let l=Math.round(a.similarity*100),m=a.memory||a.content||"";console.log(`
**Memory ${c+1}** (${l}% match)`),a.title&&console.log(`*${a.title}*`),console.log(m.slice(0,500))})):(console.log("No memories found matching your query."),console.log("Memories are automatically saved as you work in this project."))}}catch(n){console.log(`Error searching memories: ${n.message}`)}}te().catch(e=>{console.error(`Fatal error: ${e.message}`),process.exit(1)});
