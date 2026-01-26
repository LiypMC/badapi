"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { request } from "../../lib/api";
import {
  getSessionToken,
  saveApiKey,
  getApiKey,
  getApiKeys,
  setApiKey,
  removeApiKey
} from "../../lib/storage";

export default function KeysPage() {
  const [name, setName] = useState("");
  const [keys, setKeys] = useState([]);
  const [sessionToken, setSessionToken] = useState("");
  const [existingKey, setExistingKey] = useState("");
  const [savedKeys, setSavedKeys] = useState([]);
  const [activeKey, setActiveKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchKeys = async () => {
    setError("");
    try {
      const token = getSessionToken();
      setSessionToken(token);
      if (!token) {
        return;
      }
      const { data } = await request("/auth/apikeys", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKeys(data.keys || []);
    } catch (err) {
      setError(err.message || "Failed to load keys.");
    }
  };

  useEffect(() => {
    fetchKeys();
    setExistingKey(getApiKey());
    setSavedKeys(getApiKeys());
    setActiveKey(getApiKey());
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const token = getSessionToken();
      const { data } = await request("/auth/apikeys", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      const entry = {
        raw: data.api_key,
        label: name || "New key",
        last4: data.last4,
        savedAt: new Date().toISOString()
      };
      setSavedKeys(saveApiKey(entry));
      setExistingKey(data.api_key);
      setActiveKey(data.api_key);
      setMessage(`New key created and stored locally (last4: ${data.last4}).`);
      setName("");
      await fetchKeys();
    } catch (err) {
      setError(err.message || "Failed to create key.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (keyId) => {
    setLoading(true);
    setError("");
    try {
      const token = getSessionToken();
      await request(`/auth/apikeys/${keyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage("Key revoked.");
      await fetchKeys();
    } catch (err) {
      setError(err.message || "Failed to revoke key.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExisting = () => {
    if (!existingKey) {
      setError("Paste an API key first.");
      return;
    }
    const entry = {
      raw: existingKey,
      label: "Imported key",
      last4: existingKey.slice(-4),
      savedAt: new Date().toISOString()
    };
    setSavedKeys(saveApiKey(entry));
    setActiveKey(existingKey);
    setMessage("API key stored locally for uploads and summaries.");
  };

  const handleSelectActive = (value) => {
    setActiveKey(value);
    setApiKey(value);
  };

  const handleRemoveSaved = (raw) => {
    setSavedKeys(removeApiKey(raw));
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied to clipboard.");
    } catch {
      setMessage("Copy failed.");
    }
  };

  return (
    <section className="section">
      <div className="panel">
        <h2>API Key Management</h2>
        <p className="muted">
          Uses your session token to mint and revoke API keys. The newest key is stored locally.
        </p>
        {!sessionToken && (
          <div className="alert">
            Missing session token. <Link href="/auth">Login first</Link>.
          </div>
        )}
        <form className="form" onSubmit={handleCreate}>
          <input
            className="input"
            placeholder="Key name (laptop, script, prod)"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create API Key"}
          </button>
        </form>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert">{error}</div>}
      </div>

      <div className="panel">
        <h3>Active API Key</h3>
        <p className="muted">Select which key should be used across the dashboard.</p>
        <div className="form">
          <select className="select" value={activeKey} onChange={(event) => handleSelectActive(event.target.value)}>
            <option value="">Select a saved key</option>
            {savedKeys.map((key) => (
              <option key={key.raw} value={key.raw}>
                {key.label || "Key"} • {key.last4}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel">
        <h3>Import Existing Key</h3>
        <p className="muted">Paste a legacy key or one created elsewhere.</p>
        <div className="inline">
          <input
            className="input mono"
            placeholder="API Key"
            value={existingKey}
            onChange={(event) => setExistingKey(event.target.value)}
          />
          <button className="btn secondary" type="button" onClick={handleSaveExisting}>
            Save
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Saved Keys</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Last4</th>
              <th>Saved</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {savedKeys.map((key) => (
              <tr key={key.raw}>
                <td>{key.label || "Key"}</td>
                <td className="mono">{key.last4}</td>
                <td>{key.savedAt ? new Date(key.savedAt).toLocaleString() : "—"}</td>
                <td>
                  <div className="row">
                    <button className="btn secondary" type="button" onClick={() => handleCopy(key.raw)}>
                      Copy
                    </button>
                    <button className="btn secondary" type="button" onClick={() => handleRemoveSaved(key.raw)}>
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!savedKeys.length && (
              <tr>
                <td colSpan="4" className="muted">
                  No saved keys yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Active Keys</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Last4</th>
              <th>Created</th>
              <th>Last Used</th>
              <th>Revoked</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.key_id}>
                <td>{key.name || "—"}</td>
                <td className="mono">{key.last4}</td>
                <td>{key.created_at ? new Date(key.created_at).toLocaleString() : "—"}</td>
                <td>{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "—"}</td>
                <td>{key.revoked_at ? new Date(key.revoked_at).toLocaleString() : "—"}</td>
                <td>
                  <button className="btn secondary" type="button" onClick={() => handleRevoke(key.key_id)}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
            {!keys.length && (
              <tr>
                <td colSpan="6" className="muted">
                  No keys yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
