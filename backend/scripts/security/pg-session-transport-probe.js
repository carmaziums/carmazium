'use strict';
/** Read-only direct-pg session-transport health probe on an existing Fly VM.
 *  No session rows or connection credentials are accessed or printed.
 */
async function main(){
 const {Pool}=require('pg');
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:6000});
 try{
   const r=await pool.query('SELECT current_user::text AS connected_role, 1::int AS probe');
   if(!r.rows||r.rows.length!==1||r.rows[0].probe!==1)
     throw new Error('Unexpected health-query response');
   console.log(JSON.stringify({inspection:'read-only existing pg pool',connected:true,connected_role:r.rows[0].connected_role}));
 }catch(e){
   const code=(typeof e?.code==='string'&&/^[A-Za-z0-9_]{1,15}$/.test(e.code))?e.code:'UNCLASSIFIED';
   console.log(JSON.stringify({inspection:'read-only existing pg pool',connected:false,code}));
 }finally{try{await pool.end();}catch{/* no connection secrets in errors */}}
}
void main();
