#!/usr/bin/env node
var u=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var I=u((se,A)=>{var x=require("better-sqlite3"),f=require("node:fs"),p=require("node:path"),j=require("node:os"),y=p.join(j.homedir(),".local-memory"),L=p.join(y,"memory.db"),m=null;function b(e){f.existsSync(e)||f.mkdirSync(e,{recursive:!0,mode:448})}function w(e=L){if(m)return m;let t=e===":memory:";t||b(p.dirname(e));let n=new x(e);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),h(n),!t)try{f.chmodSync(e,384)}catch{}return m=n,n}function h(e){e.exec(`
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
  `),v(e)}function v(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function H(){m&&(m.close(),m=null)}A.exports={getDb:w,closeDb:H,runMigrations:h,DEFAULT_DB_PATH:L,DEFAULT_DB_DIR:y}});var D=u((ie,O)=>{var G=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function Y(e,t=1e5){if(!e||typeof e!="string")return"";let n=e;for(let s of G)n=n.replace(s,"");return n.length>t&&(n=n.slice(0,t)),n}function $(e,t=1,n=1e5){return e.length<t?{valid:!1,reason:`content below minimum length (${t})`}:e.length>n?{valid:!1,reason:`content exceeds maximum length (${n})`}:{valid:!0}}function P(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function B(e){if(!e||typeof e!="object")return{};let t={},n=0;for(let[s,o]of Object.entries(e)){if(n>=50)break;s.length>128||/[^\w.-]/.test(s)||(typeof o=="string"?(t[s]=o.slice(0,1024),n++):(typeof o=="number"&&Number.isFinite(o)||typeof o=="boolean")&&(t[s]=o,n++))}return t}O.exports={sanitizeContent:Y,validateContentLength:$,validateContainerTag:P,sanitizeMetadata:B}});var F=u((ce,U)=>{var{getDb:q,closeDb:ae}=I(),{sanitizeContent:S,sanitizeMetadata:k,validateContainerTag:W,validateContentLength:z}=D(),V="claudecode_default",g=class{constructor(t,n){this.containerTag=t||V,this.dbPath=n}_getDb(){return q(this.dbPath)}async addMemory(t,n,s={},o=null){let i=this._getDb(),r=n||this.containerTag;W(r);let c=S(t);z(c);let a=k({sm_source:"claude-code-plugin",...s}),l=a.project||null,T=a.type||"session_turn",d=JSON.stringify(a);if(o){let R=i.prepare("SELECT id FROM memories WHERE custom_id = ?").get(o);if(R)return i.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(c,r,l,T,d,o),{id:R.id,status:"updated",containerTag:r}}return{id:i.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(c,r,l,T,a.session_id||null,o,d).lastInsertRowid,status:"created",containerTag:r}}async search(t,n,s={}){let o=this._getDb(),i=n||this.containerTag,r=s.limit||10,c=S(t).replace(/['"]/g,"").trim();if(!c)return{results:[],total:0};let a=c.split(/\s+/).filter(Boolean).map(l=>`"${l}"`).join(" OR ");try{let l=o.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(a,i,r),T=l.length>0?Math.max(...l.map(E=>Math.abs(E.rank))):1,d=l.map(E=>({id:E.id,memory:E.content,content:E.content,similarity:T>0?Math.abs(E.rank)/T:0,containerTag:E.container_tag,title:E.project_name,createdAt:E.created_at}));return{results:d,total:d.length}}catch{return{results:[],total:0}}}async getProfile(t,n){let s=this._getDb(),o=t||this.containerTag,i=s.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(o).map(a=>a.fact_text),r=s.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(o).map(a=>a.fact_text),c=n?await this.search(n,o,{limit:10}):{results:[],total:0};return{profile:{static:i,dynamic:r},searchResults:c.results.length>0?c:void 0}}async listMemories(t,n=20){let s=this._getDb(),o=t||this.containerTag;return{memories:s.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(o,n)}}async deleteMemory(t){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(t)}};U.exports={LocalMemoryClient:g}});var X=u((le,C)=>{var{execSync:M}=require("node:child_process"),Z=require("node:crypto");function _(e){return Z.createHash("sha256").update(e).digest("hex").slice(0,16)}function N(e){try{return M("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function K(e){let n=N(e)||e;return`claudecode_project_${_(n)}`}function Q(e){return(N(e)||e).split("/").pop()||"unknown"}function J(){try{let t=M("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${_(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${_(e)}`}C.exports={sha256:_,getGitRoot:N,getContainerTag:K,getProjectName:Q,getUserContainerTag:J}});var{LocalMemoryClient:ee}=F(),{getContainerTag:te,getProjectName:ne}=X();async function oe(){let e=process.argv.slice(2).join(" ");if(!e||!e.trim()){console.log("No search query provided. Please specify what you want to search for.");return}let t=process.cwd(),n=te(t),s=ne(t);try{let i=await new ee(n).getProfile(n,e);console.log(`## Memory Search: "${e}"`),console.log(`Project: ${s}
`),i.profile&&(i.profile.static?.length>0&&(console.log("### User Preferences"),i.profile.static.forEach(r=>console.log(`- ${r}`)),console.log("")),i.profile.dynamic?.length>0&&(console.log("### Recent Context"),i.profile.dynamic.forEach(r=>console.log(`- ${r}`)),console.log(""))),i.searchResults?.results?.length>0?(console.log("### Relevant Memories"),i.searchResults.results.forEach((r,c)=>{let a=Math.round(r.similarity*100),l=r.memory||r.content||"";console.log(`
**Memory ${c+1}** (${a}% match)`),r.title&&console.log(`*${r.title}*`),console.log(l.slice(0,500))})):(console.log("No memories found matching your query."),console.log("Memories are automatically saved as you work in this project."))}catch(o){console.error(`Error searching memories: ${o.message}`)}}oe().catch(e=>{console.error(`Fatal error: ${e.message}`),process.exit(1)});
