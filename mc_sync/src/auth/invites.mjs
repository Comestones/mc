import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { hashPassword } from './password.mjs';
// Error type is injected to keep this module independent of service initialization.
export function createInvites(pool, liveSession, AuthError) {
  const digest = token => createHash('sha256').update(token).digest('hex');
  const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value);
  const tokenHash = token => { if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthError(410); return digest(token); };
  async function owner(client, identity, workspaceId) {
    if (!validId(workspaceId)) throw new AuthError(400);
    if (!identity || identity.expiresAt <= Date.now()) throw new AuthError();
    await liveSession(identity.id, identity.userId);
    const result = await client.query("SELECT m.user_id FROM mc_memberships m JOIN mc_users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.role='owner' AND u.disabled_at IS NULL FOR SHARE OF m,u", [workspaceId,identity.userId]);
    if (!result.rows.length) throw new AuthError(403);
  }
  async function transaction(action) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); await client.query("SET LOCAL lock_timeout='5s'"); const result=await action(client); await client.query('COMMIT'); return result; }
    catch(error) { await client.query('ROLLBACK').catch(()=>{}); if(error.code==='23505') throw new AuthError(409); throw error; }
    finally { client.release(); }
  }
  async function lockedInvite(client, token) {
    const result = await client.query('SELECT * FROM mc_invite_tokens WHERE token_hash=$1 FOR UPDATE', [tokenHash(token)]);
    const invite = result.rows[0]; if(!invite) throw new AuthError(410);
    const creator = await client.query("SELECT m.user_id FROM mc_memberships m JOIN mc_users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.role='owner' AND u.disabled_at IS NULL FOR SHARE OF m,u", [invite.workspace_id,invite.created_by]);
    if(!creator.rows.length) throw new AuthError(410);
    const valid = await client.query('SELECT id FROM mc_invite_tokens WHERE id=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp() AND uses<max_uses', [invite.id]);
    if(!valid.rows.length) throw new AuthError(410);
    return invite;
  }
  async function consume(client, id) {
    const result = await client.query('UPDATE mc_invite_tokens SET uses=uses+1 WHERE id=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp() AND uses<max_uses RETURNING id', [id]);
    if(!result.rows.length) throw new AuthError(410);
  }
  return {
    createInvite(identity, data) {
      if(!Number.isInteger(data.expiresInHours) || data.expiresInHours<1 || data.expiresInHours>720 || !Number.isInteger(data.maxUses) || data.maxUses<1 || data.maxUses>100) throw new AuthError(400);
      return transaction(async client=>{
        await owner(client,identity,data.workspaceId);
        const token=randomBytes(32).toString('base64url');
        const result=await client.query("INSERT INTO mc_invite_tokens (id,workspace_id,created_by,token_hash,expires_at,max_uses) VALUES ($1,$2,$3,$4,clock_timestamp()+$5*interval '1 hour',$6) RETURNING id,expires_at,max_uses",[randomUUID(),data.workspaceId,identity.userId,digest(token),data.expiresInHours,data.maxUses]);
        return {token,...result.rows[0]};
      });
    },
    listInvites(identity,data) {
      return transaction(async client=>{await owner(client,identity,data.workspaceId);return {invites:(await client.query('SELECT id,expires_at,max_uses,uses,revoked_at FROM mc_invite_tokens WHERE workspace_id=$1 ORDER BY expires_at DESC,id LIMIT 100',[data.workspaceId])).rows};});
    },
    revokeInvite(identity,data) {
      if(typeof data.id!=='string' || !/^[a-f0-9-]{36}$/.test(data.id)) throw new AuthError(400);
      return transaction(async client=>{await owner(client,identity,data.workspaceId);const result=await client.query('UPDATE mc_invite_tokens SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE id=$1 AND workspace_id=$2 RETURNING id',[data.id,data.workspaceId]);if(!result.rows.length) throw new AuthError(403);return {ok:true};});
    },
    async previewInvite(data) {
      const result=await pool.query("SELECT w.name FROM mc_invite_tokens i JOIN mc_workspaces w ON w.id=i.workspace_id JOIN mc_users u ON u.id=i.created_by JOIN mc_memberships m ON m.workspace_id=i.workspace_id AND m.user_id=i.created_by WHERE i.token_hash=$1 AND i.revoked_at IS NULL AND i.expires_at>clock_timestamp() AND i.uses<i.max_uses AND u.disabled_at IS NULL AND m.role='owner'",[tokenHash(data.token)]);
      if(!result.rows.length) throw new AuthError(410);return {workspaceName:result.rows[0].name};
    },
    async registerInvite(data) {
      tokenHash(data.token);
      const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
      const name=typeof data.displayName==='string'?data.displayName.trim():'';
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !name || name.length>80 || /[\u0000-\u001f\u007f]/.test(name)) throw new AuthError(400);
      let passwordHash;try{passwordHash=await hashPassword(data.password);}catch{throw new AuthError(400);}
      return transaction(async client=>{
        const invite=await lockedInvite(client,data.token), userId=randomUUID();
        await consume(client,invite.id);
        await client.query('INSERT INTO mc_users (id,email,display_name,password_hash) VALUES ($1,$2,$3,$4)',[userId,email,name,passwordHash]);
        await client.query("INSERT INTO mc_memberships (workspace_id,user_id,role) VALUES ($1,$2,'editor')",[invite.workspace_id,userId]);
        return {joined:true};
      });
    },
    async joinInvite(identity,data) {
      if(!identity || identity.expiresAt<=Date.now()) throw new AuthError();
      await liveSession(identity.id,identity.userId);
      return transaction(async client=>{
        const invite=await lockedInvite(client,data.token);
        const member=await client.query('SELECT role FROM mc_memberships WHERE workspace_id=$1 AND user_id=$2',[invite.workspace_id,identity.userId]);
        if(!member.rows.length){await consume(client,invite.id);await client.query("INSERT INTO mc_memberships (workspace_id,user_id,role) VALUES ($1,$2,'editor')",[invite.workspace_id,identity.userId]);}
        return {joined:true};
      });
    },
  };
}
