import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderGit2, Play, Code, Trash2, Clock, FileCode, GitBranch, Zap, Loader } from 'lucide-react';
import '../App.css';

interface Project {
  id: string;
  name: string;
  path: string;
  indexedAt: string;
  functionCount: number;
  fileCount: number;
  languages: string[];
}

const Home = () => {
  const [targetDir, setTargetDir] = useState('');
  const [isIndexing, setIsIndexing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:9000/api/projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  const handleIndexSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDir.trim()) return;

    setIsIndexing(true);
    try {
      const res = await fetch('http://localhost:9000/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDir: targetDir.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        // Refresh projects list
        await fetchProjects();
        setTargetDir('');
        // Navigate to explorer
        navigate(`/explorer?workspace=${encodeURIComponent(data.project?.path || targetDir.trim())}`);
      } else {
        const error = await res.json();
        alert(`Indexing failed: ${error.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to GraphHub API.');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm('Remove this project from the list?')) return;

    try {
      await fetch(`http://localhost:9000/api/projects/${projectId}`, { method: 'DELETE' });
      await fetchProjects();
    } catch (err) {
      console.error('Failed to delete project', err);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const langColors: Record<string, string> = {
    python: '#3572A5',
    typescript: '#3178c6',
    javascript: '#f7df1e',
    tsx: '#3178c6',
    java: '#b07219',
    go: '#00ADD8',
    rust: '#dea584',
  };

  return (
    <div className="home-container">
      <div className="home-hero">
        <div style={{
          background: 'var(--mongodb-slate)', padding: '24px', borderRadius: '32px',
          display: 'inline-flex', marginBottom: '32px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: '1px solid var(--mongodb-border)'
        }}>
          <Zap size={64} fill="var(--mongodb-spring-green)" strokeWidth={1} />
        </div>
        <h1 style={{ fontSize: '72px', fontFamily: 'var(--font-serif)', marginBottom: '16px', letterSpacing: '-2px' }}>GraphHub</h1>
        <p style={{ fontSize: '20px', color: 'var(--mongodb-gray-light-2)', maxWidth: '700px', margin: '0 auto', lineHeight: 1.6 }}>
          The local-first code intelligence platform.
          Transform any codebase into an interactive knowledge graph and understand complex architectures in seconds.
        </p>
      </div>

      <div className="home-card">
        <h2>
          <FolderGit2 size={22} color="var(--mongodb-spring-green)" />
          Index a New Codebase
        </h2>

        <form onSubmit={handleIndexSubmit}>
          <div>
            <label>Directory Path</label>
            <input
              type="text"
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              placeholder="C:\Projects\my-app or /home/user/project"
              disabled={isIndexing}
            />
          </div>

          <button type="submit" disabled={isIndexing || !targetDir.trim()} className="btn-primary" style={{ marginTop: '12px' }}>
            {isIndexing ? (
              <><Loader size={18} className="animate-spin" /> Indexing Codebase…</>
            ) : (
              <>
                <Play size={18} fill="currentColor" />
                Index & Explore
              </>
            )}
          </button>
        </form>
      </div>

      {/* Saved Projects */}
      <div className="home-card" style={{ marginTop: 24 }}>
        <h2>
          <Code size={22} color="var(--mongodb-spring-green)" />
          Your Codebases
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--mongodb-gray-dark-1)' }}>
            <Loader size={32} className="animate-spin" style={{ marginBottom: '16px' }} />
            <p>Fetching projects from index…</p>
          </div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--mongodb-gray-dark-1)' }}>
            <GitBranch size={48} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: '16px' }}>No codebases indexed yet.<br />Add a directory path above to begin.</p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <div
                key={project.id}
                className="project-card"
                onClick={() => navigate(`/explorer?workspace=${encodeURIComponent(project.path)}`)}
              >
                <div className="project-header">
                  <h3>{project.name}</h3>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    title="Remove from list"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="project-path">{project.path}</div>

                <div className="project-stats">
                  <div className="stat">
                    <FileCode size={14} />
                    <span>{project.functionCount} functions</span>
                  </div>
                  <div className="stat">
                    <Code size={14} />
                    <span>{project.fileCount} files</span>
                  </div>
                  <div className="stat">
                    <Clock size={14} />
                    <span>{formatDate(project.indexedAt)}</span>
                  </div>
                </div>

                {project.languages.length > 0 && (
                  <div className="project-languages">
                    {project.languages.map((lang) => (
                      <span
                        key={lang}
                        className="lang-tag"
                        style={{
                          background: `${langColors[lang.toLowerCase()] || '#666'}20`,
                          borderColor: langColors[lang.toLowerCase()] || '#666',
                          color: langColors[lang.toLowerCase()] || '#999'
                        }}
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
