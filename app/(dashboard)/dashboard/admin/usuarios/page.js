'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useUserContext } from '@/components/UserContext';

const placeholderImage =
  'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=300&q=60';

export default function UsuariosAdminPage() {
  const { profile } = useUserContext();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    const fetchUsers = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'No se pudo cargar la lista de usuarios.');
        }
        setUsers(data);
      } catch (err) {
        setError(err.message || 'Error inesperado cargando usuarios.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [profile]);

  if (profile?.role !== 'admin') {
    return <div className="alert-banner alert-danger">Solo los administradores pueden gestionar usuarios.</div>;
  }

  const startEditing = user => {
    setEditingId(user.id);
    setEditForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      role: user.role || 'user',
      credits_remaining: user.credits_remaining ?? 0,
      location: user.location || '',
      notify_whatsapp_on_diagnosis: user.notify_whatsapp_on_diagnosis !== false,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async userId => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...editForm }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al actualizar usuario.');
      }

      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, ...result.profile } : u))
      );
      setEditingId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const renderRows = () => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}>
            Cargando usuarios...
          </td>
        </tr>
      );
    }

    if (error) {
      return (
        <tr>
          <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}>
            {error}
          </td>
        </tr>
      );
    }

    if (users.length === 0) {
      return (
        <tr>
          <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}>
            No se encontraron usuarios.
          </td>
        </tr>
      );
    }

    return users.map(user => {
      const isEditing = editingId === user.id;
      const imageSrc = user.latest_image || placeholderImage;
      const fullName =
        [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'Sin nombre';

      if (isEditing) {
        return (
          <tr key={user.id} style={{ backgroundColor: '#f9fafb' }}>
            <td colSpan={7}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem' }}>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Nombre</label>
                  <input
                    className="input-field w-full"
                    value={editForm.first_name}
                    onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Apellido</label>
                  <input
                    className="input-field w-full"
                    value={editForm.last_name}
                    onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Teléfono</label>
                  <input
                    className="input-field w-full"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Ubicación</label>
                  <input
                    className="input-field w-full"
                    value={editForm.location}
                    onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Rol</label>
                  <select
                    className="input-field w-full"
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="user">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Créditos</label>
                  <input
                    type="number"
                    className="input-field w-full"
                    value={editForm.credits_remaining}
                    onChange={e => setEditForm({ ...editForm, credits_remaining: Number(e.target.value) })}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editForm.notify_whatsapp_on_diagnosis !== false}
                      onChange={e => setEditForm({ ...editForm, notify_whatsapp_on_diagnosis: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span className="text-xs font-semibold text-gray-500">Permitir notificaciones en WhatsApp</span>
                  </label>
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button onClick={cancelEditing} className="btn-secondary">Cancelar</button>
                  <button onClick={() => handleSave(user.id)} className="btn-primary">Guardar Cambios</button>
                </div>
              </div>
            </td>
          </tr>
        );
      }

      return (
        <tr key={user.id}>
          <td>
            <div style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', overflow: 'hidden' }}>
              <Image src={imageSrc} alt={`Foto de ${fullName}`} fill sizes="40px" style={{ objectFit: 'cover' }} />
            </div>
          </td>
          <td>
            <div style={{ fontWeight: 600 }}>{fullName}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{user.email}</div>
          </td>
          <td>{user.phone || '-'}</td>
          <td>{user.location || '-'}</td>
          <td>
            <span className={`badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
              {user.role}
            </span>
          </td>
          <td style={{ textAlign: 'center', fontWeight: 600 }}>{user.credits_remaining}</td>
          <td style={{ textAlign: 'center' }}>
            {user.notify_whatsapp_on_diagnosis !== false ? (
              <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Habilitado</span>
            ) : (
              <span style={{ color: '#ef4444', fontWeight: 600 }}>❌ Deshabilitado</span>
            )}
          </td>
          <td style={{ textAlign: 'right' }}>
            <button
              onClick={() => startEditing(user)}
              className="btn-secondary"
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
            >
              Editar
            </button>
          </td>
        </tr>
      );
    });
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Administración</p>
        <h1 style={{ margin: '4px 0 8px', fontSize: '1.9rem' }}>Gestión de usuarios</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          Control total sobre perfiles, roles y créditos.
        </p>
      </header>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table-minimal" style={{ minWidth: '800px' }}>
          <thead>
            <tr>
              <th style={{ width: 60 }}></th>
              <th>Usuario</th>
              <th>Teléfono</th>
              <th>Ubicación</th>
              <th>Rol</th>
              <th style={{ textAlign: 'center' }}>Créditos</th>
              <th>WhatsApp</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>{renderRows()}</tbody>
        </table>
      </div>
    </div>
  );
}
