import React, { useState, useEffect } from 'react';
import { Plus, Users, FolderKanban, CheckSquare, LayoutDashboard, Edit2, Trash2, Clock, AlertCircle, CheckCircle, User } from 'lucide-react';

export default function ClientProjectManager() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Modal states
  const [showClientModal, setShowClientModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Storage helper - uses localStorage as fallback
  const storage = {
    async get(key) {
      try {
        // Try window.storage first if available
        if (window.storage && typeof window.storage.get === 'function') {
          return await window.storage.get(key);
        }
      } catch (error) {
        console.log('window.storage not available, using localStorage');
      }
      
      // Fallback to localStorage
      const value = localStorage.getItem(key);
      return value ? { key, value } : null;
    },
    
    async set(key, value) {
      try {
        // Try window.storage first if available
        if (window.storage && typeof window.storage.set === 'function') {
          return await window.storage.set(key, value);
        }
      } catch (error) {
        console.log('window.storage not available, using localStorage');
      }
      
      // Fallback to localStorage
      localStorage.setItem(key, value);
      return { key, value };
    },
    
    async delete(key) {
      try {
        // Try window.storage first if available
        if (window.storage && typeof window.storage.delete === 'function') {
          return await window.storage.delete(key);
        }
      } catch (error) {
        console.log('window.storage not available, using localStorage');
      }
      
      // Fallback to localStorage
      localStorage.removeItem(key);
      return { key, deleted: true };
    }
  };

  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [clientsRes, projectsRes, tasksRes, teamRes] = await Promise.all([
        storage.get('clients').catch(() => null),
        storage.get('projects').catch(() => null),
        storage.get('tasks').catch(() => null),
        storage.get('team-members').catch(() => null)
      ]);

      if (clientsRes?.value) setClients(JSON.parse(clientsRes.value));
      if (projectsRes?.value) setProjects(JSON.parse(projectsRes.value));
      if (tasksRes?.value) setTasks(JSON.parse(tasksRes.value));
      if (teamRes?.value) setTeamMembers(JSON.parse(teamRes.value));
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Error loading data. Starting fresh.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveClients = async (newClients) => {
    try {
      await storage.set('clients', JSON.stringify(newClients));
      setClients(newClients);
      return true;
    } catch (error) {
      console.error('Error saving clients:', error);
      showNotification('Error saving client. Please try again.', 'error');
      return false;
    }
  };

  const saveProjects = async (newProjects) => {
    try {
      await storage.set('projects', JSON.stringify(newProjects));
      setProjects(newProjects);
      return true;
    } catch (error) {
      console.error('Error saving projects:', error);
      showNotification('Error saving project. Please try again.', 'error');
      return false;
    }
  };

  const saveTasks = async (newTasks) => {
    try {
      await storage.set('tasks', JSON.stringify(newTasks));
      setTasks(newTasks);
      return true;
    } catch (error) {
      console.error('Error saving tasks:', error);
      showNotification('Error saving task. Please try again.', 'error');
      return false;
    }
  };

  const saveTeamMembers = async (newTeam) => {
    try {
      console.log('Attempting to save team members:', newTeam);
      await storage.set('team-members', JSON.stringify(newTeam));
      console.log('Team members saved successfully');
      setTeamMembers(newTeam);
      return true;
    } catch (error) {
      console.error('Error saving team members:', error);
      showNotification('Error saving team member. Please try again.', 'error');
      return false;
    }
  };

  // Client functions
  const addClient = async (client) => {
    const newClient = { ...client, id: Date.now().toString() };
    const success = await saveClients([...clients, newClient]);
    if (success) showNotification('Client added successfully!');
  };

  const updateClient = async (id, updatedClient) => {
    const success = await saveClients(clients.map(c => c.id === id ? { ...updatedClient, id } : c));
    if (success) showNotification('Client updated successfully!');
  };

  const deleteClient = async (id) => {
    if (confirm('Delete this client? Associated projects and tasks will remain but won\'t be linked.')) {
      const success = await saveClients(clients.filter(c => c.id !== id));
      if (success) showNotification('Client deleted successfully!');
    }
  };

  // Project functions
  const addProject = async (project) => {
    const newProject = { ...project, id: Date.now().toString() };
    const success = await saveProjects([...projects, newProject]);
    if (success) showNotification('Project added successfully!');
  };

  const updateProject = async (id, updatedProject) => {
    const success = await saveProjects(projects.map(p => p.id === id ? { ...updatedProject, id } : p));
    if (success) showNotification('Project updated successfully!');
  };

  const deleteProject = async (id) => {
    if (confirm('Delete this project? Associated tasks will remain but won\'t be linked.')) {
      const success = await saveProjects(projects.filter(p => p.id !== id));
      if (success) showNotification('Project deleted successfully!');
    }
  };

  // Task functions
  const addTask = async (task) => {
    const newTask = { ...task, id: Date.now().toString() };
    const success = await saveTasks([...tasks, newTask]);
    if (success) showNotification('Task added successfully!');
  };

  const updateTask = async (id, updatedTask) => {
    const success = await saveTasks(tasks.map(t => t.id === id ? { ...updatedTask, id } : t));
    if (success) showNotification('Task updated successfully!');
  };

  const deleteTask = async (id) => {
    if (confirm('Delete this task?')) {
      const success = await saveTasks(tasks.filter(t => t.id !== id));
      if (success) showNotification('Task deleted successfully!');
    }
  };

  // Team functions
  const addTeamMember = async (member) => {
    console.log('addTeamMember called with:', member);
    const newMember = { ...member, id: Date.now().toString() };
    console.log('New member with ID:', newMember);
    const newTeamArray = [...teamMembers, newMember];
    console.log('New team array:', newTeamArray);
    const success = await saveTeamMembers(newTeamArray);
    if (success) {
      showNotification('Team member added successfully!');
      console.log('Team member added successfully');
    } else {
      console.log('Failed to add team member');
    }
  };

  const updateTeamMember = async (id, updatedMember) => {
    const success = await saveTeamMembers(teamMembers.map(m => m.id === id ? { ...updatedMember, id } : m));
    if (success) showNotification('Team member updated successfully!');
  };

  const deleteTeamMember = async (id) => {
    if (confirm('Delete this team member?')) {
      const success = await saveTeamMembers(teamMembers.filter(m => m.id !== id));
      if (success) showNotification('Team member deleted successfully!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-amber-600 text-xl font-serif">Loading your workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap');
        
        * {
          font-family: 'DM Sans', sans-serif;
        }
        
        h1, h2, h3, h4 {
          font-family: 'Crimson Pro', serif;
        }
        
        .task-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .task-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.15);
        }
        
        .tab-button {
          position: relative;
          transition: all 0.3s ease;
        }
        
        .tab-button.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #d97706, #f59e0b);
          border-radius: 3px 3px 0 0;
        }
        
        .status-badge {
          animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        
        .modal-backdrop {
          animation: fadeIn 0.2s ease-in;
        }
        
        .modal-content {
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .notification {
          animation: slideInRight 0.3s ease-out;
        }
        
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Notification */}
      {notification && (
        <div className={`notification fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        } text-white font-medium`}>
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b-2 border-amber-600 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-4xl font-bold text-stone-900 mb-2">Client Success Hub</h1>
          <p className="text-stone-600">Manage your clients, projects, and tasks in one place</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'clients', label: 'Clients', icon: Users },
              { id: 'projects', label: 'Projects', icon: FolderKanban },
              { id: 'tasks', label: 'Tasks', icon: CheckSquare },
              { id: 'team', label: 'Team', icon: User }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-button flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'active text-amber-700 bg-amber-50'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && (
          <DashboardView 
            clients={clients}
            projects={projects}
            tasks={tasks}
            teamMembers={teamMembers}
          />
        )}
        
        {activeTab === 'clients' && (
          <ClientsView
            clients={clients}
            onAdd={() => { setEditingItem(null); setShowClientModal(true); }}
            onEdit={(client) => { setEditingItem(client); setShowClientModal(true); }}
            onDelete={deleteClient}
            projects={projects}
            tasks={tasks}
          />
        )}
        
        {activeTab === 'projects' && (
          <ProjectsView
            projects={projects}
            clients={clients}
            tasks={tasks}
            onAdd={() => { setEditingItem(null); setShowProjectModal(true); }}
            onEdit={(project) => { setEditingItem(project); setShowProjectModal(true); }}
            onDelete={deleteProject}
          />
        )}
        
        {activeTab === 'tasks' && (
          <TasksView
            tasks={tasks}
            projects={projects}
            clients={clients}
            teamMembers={teamMembers}
            onAdd={() => { setEditingItem(null); setShowTaskModal(true); }}
            onEdit={(task) => { setEditingItem(task); setShowTaskModal(true); }}
            onDelete={deleteTask}
            onUpdateStatus={updateTask}
          />
        )}
        
        {activeTab === 'team' && (
          <TeamView
            teamMembers={teamMembers}
            tasks={tasks}
            onAdd={() => { setEditingItem(null); setShowTeamModal(true); }}
            onEdit={(member) => { setEditingItem(member); setShowTeamModal(true); }}
            onDelete={deleteTeamMember}
          />
        )}
      </main>

      {/* Modals */}
      {showClientModal && (
        <ClientModal
          client={editingItem}
          onSave={(client) => {
            if (editingItem) {
              updateClient(editingItem.id, client);
            } else {
              addClient(client);
            }
            setShowClientModal(false);
            setEditingItem(null);
          }}
          onClose={() => { setShowClientModal(false); setEditingItem(null); }}
        />
      )}

      {showProjectModal && (
        <ProjectModal
          project={editingItem}
          clients={clients}
          onSave={(project) => {
            if (editingItem) {
              updateProject(editingItem.id, project);
            } else {
              addProject(project);
            }
            setShowProjectModal(false);
            setEditingItem(null);
          }}
          onClose={() => { setShowProjectModal(false); setEditingItem(null); }}
        />
      )}

      {showTaskModal && (
        <TaskModal
          task={editingItem}
          projects={projects}
          clients={clients}
          teamMembers={teamMembers}
          onSave={(task) => {
            if (editingItem) {
              updateTask(editingItem.id, task);
            } else {
              addTask(task);
            }
            setShowTaskModal(false);
            setEditingItem(null);
          }}
          onClose={() => { setShowTaskModal(false); setEditingItem(null); }}
        />
      )}

      {showTeamModal && (
        <TeamModal
          member={editingItem}
          onSave={(member) => {
            console.log('TeamModal onSave called with:', member);
            if (editingItem) {
              updateTeamMember(editingItem.id, member);
            } else {
              addTeamMember(member);
            }
            setShowTeamModal(false);
            setEditingItem(null);
          }}
          onClose={() => { setShowTeamModal(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

// Dashboard View Component
function DashboardView({ clients, projects, tasks, teamMembers }) {
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const upcomingTasks = activeTasks.filter(t => {
    if (!t.dueDate) return false;
    const dueDate = new Date(t.dueDate);
    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return dueDate >= today && dueDate <= sevenDaysFromNow;
  });
  const overdueTasks = activeTasks.filter(t => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < new Date();
  });

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Active Clients"
          value={clients.length}
          icon={Users}
          color="amber"
        />
        <StatCard
          label="Active Projects"
          value={projects.filter(p => p.status !== 'completed').length}
          icon={FolderKanban}
          color="blue"
        />
        <StatCard
          label="Open Tasks"
          value={activeTasks.length}
          icon={CheckSquare}
          color="green"
        />
        <StatCard
          label="Team Members"
          value={teamMembers.length}
          icon={User}
          color="purple"
        />
      </div>

      {/* Alerts */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <AlertCircle className="text-red-600 mt-0.5 mr-3" size={20} />
            <div>
              <h3 className="font-semibold text-red-900">Overdue Tasks</h3>
              <p className="text-red-700 text-sm mt-1">
                You have {overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''} that need attention.
              </p>
            </div>
          </div>
        </div>
      )}

      {upcomingTasks.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <Clock className="text-amber-600 mt-0.5 mr-3" size={20} />
            <div>
              <h3 className="font-semibold text-amber-900">Upcoming Tasks</h3>
              <p className="text-amber-700 text-sm mt-1">
                {upcomingTasks.length} task{upcomingTasks.length !== 1 ? 's' : ''} due in the next 7 days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-stone-200 p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-stone-900 mb-4">Recent Clients</h2>
          {clients.length === 0 ? (
            <p className="text-stone-500 italic">No clients yet. Add your first client to get started!</p>
          ) : (
            <div className="space-y-3">
              {clients.slice(0, 5).map(client => (
                <div key={client.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                  <div>
                    <div className="font-semibold text-stone-900">{client.name}</div>
                    <div className="text-sm text-stone-600">{client.company}</div>
                  </div>
                  <div className="text-xs text-stone-500">
                    {projects.filter(p => p.clientId === client.id).length} projects
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-stone-200 p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-stone-900 mb-4">Active Projects</h2>
          {projects.length === 0 ? (
            <p className="text-stone-500 italic">No projects yet. Create your first project!</p>
          ) : (
            <div className="space-y-3">
              {projects.filter(p => p.status !== 'completed').slice(0, 5).map(project => {
                const client = clients.find(c => c.id === project.clientId);
                return (
                  <div key={project.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                    <div>
                      <div className="font-semibold text-stone-900">{project.name}</div>
                      <div className="text-sm text-stone-600">{client?.name || 'No client'}</div>
                    </div>
                    <StatusBadge status={project.status} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Clients View Component
function ClientsView({ clients, onAdd, onEdit, onDelete, projects, tasks }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-stone-900">Clients</h2>
        <button
          onClick={onAdd}
          className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus size={20} />
          <span>Add Client</span>
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 p-12 text-center">
          <Users size={48} className="mx-auto text-stone-300 mb-4" />
          <h3 className="text-xl font-semibold text-stone-900 mb-2">No clients yet</h3>
          <p className="text-stone-600 mb-4">Start by adding your first client to track their projects and tasks.</p>
          <button
            onClick={onAdd}
            className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Add Your First Client
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => {
            const clientProjects = projects.filter(p => p.clientId === client.id);
            const clientTasks = tasks.filter(t => 
              clientProjects.some(p => p.id === t.projectId)
            );
            
            return (
              <div key={client.id} className="bg-white rounded-lg border border-stone-200 p-6 shadow-sm task-card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">{client.name}</h3>
                    <p className="text-stone-600">{client.company}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(client)}
                      className="text-stone-600 hover:text-amber-600 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => onDelete(client.id)}
                      className="text-stone-600 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                {client.email && (
                  <p className="text-sm text-stone-600 mb-2">✉️ {client.email}</p>
                )}
                {client.phone && (
                  <p className="text-sm text-stone-600 mb-4">📞 {client.phone}</p>
                )}
                
                <div className="border-t border-stone-200 pt-4 mt-4 flex justify-between text-sm">
                  <span className="text-stone-600">{clientProjects.length} projects</span>
                  <span className="text-stone-600">{clientTasks.length} tasks</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Projects View Component
function ProjectsView({ projects, clients, tasks, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-stone-900">Projects</h2>
        <button
          onClick={onAdd}
          className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus size={20} />
          <span>Add Project</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 p-12 text-center">
          <FolderKanban size={48} className="mx-auto text-stone-300 mb-4" />
          <h3 className="text-xl font-semibold text-stone-900 mb-2">No projects yet</h3>
          <p className="text-stone-600 mb-4">Create your first project to start managing tasks.</p>
          <button
            onClick={onAdd}
            className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => {
            const client = clients.find(c => c.id === project.clientId);
            const projectTasks = tasks.filter(t => t.projectId === project.id);
            const completedTasks = projectTasks.filter(t => t.status === 'completed');
            
            return (
              <div key={project.id} className="bg-white rounded-lg border border-stone-200 p-6 shadow-sm task-card">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-bold text-stone-900">{project.name}</h3>
                      <StatusBadge status={project.status} />
                    </div>
                    {client && (
                      <p className="text-stone-600 mb-2">Client: {client.name}</p>
                    )}
                    {project.description && (
                      <p className="text-stone-600 mb-4">{project.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-6 text-sm">
                      <span className="text-stone-600">
                        Tasks: {completedTasks.length}/{projectTasks.length} completed
                      </span>
                      {project.startDate && (
                        <span className="text-stone-600">Start: {project.startDate}</span>
                      )}
                      {project.endDate && (
                        <span className="text-stone-600">End: {project.endDate}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => onEdit(project)}
                      className="text-stone-600 hover:text-amber-600 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => onDelete(project.id)}
                      className="text-stone-600 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Tasks View Component
function TasksView({ tasks, projects, clients, teamMembers, onAdd, onEdit, onDelete, onUpdateStatus }) {
  const [filterStatus, setFilterStatus] = useState('all');
  
  const filteredTasks = filterStatus === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === filterStatus);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-3xl font-bold text-stone-900">Tasks</h2>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Tasks</option>
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus size={20} />
          <span>Add Task</span>
        </button>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 p-12 text-center">
          <CheckSquare size={48} className="mx-auto text-stone-300 mb-4" />
          <h3 className="text-xl font-semibold text-stone-900 mb-2">
            {filterStatus === 'all' ? 'No tasks yet' : `No ${filterStatus.replace('-', ' ')} tasks`}
          </h3>
          <p className="text-stone-600 mb-4">Create your first task to get started.</p>
          <button
            onClick={onAdd}
            className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Create Your First Task
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map(task => {
            const project = projects.find(p => p.id === task.projectId);
            const client = clients.find(c => c.id === project?.clientId);
            const assignee = teamMembers.find(m => m.id === task.assignedTo);
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
            
            return (
              <div 
                key={task.id} 
                className={`bg-white rounded-lg border p-6 shadow-sm task-card ${
                  isOverdue ? 'border-red-300 bg-red-50' : 'border-stone-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-bold text-stone-900">{task.title}</h3>
                      <StatusBadge status={task.status} />
                      {isOverdue && (
                        <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full font-medium">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    
                    {task.description && (
                      <p className="text-stone-600 mb-3">{task.description}</p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      {project && (
                        <span className="text-stone-600">
                          📁 {project.name}
                        </span>
                      )}
                      {client && (
                        <span className="text-stone-600">
                          👤 {client.name}
                        </span>
                      )}
                      {assignee && (
                        <span className="text-stone-600">
                          ✋ {assignee.name}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className={isOverdue ? 'text-red-700 font-semibold' : 'text-stone-600'}>
                          📅 Due: {task.dueDate}
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-4 flex space-x-2">
                      <button
                        onClick={() => onUpdateStatus(task.id, { ...task, status: 'todo' })}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          task.status === 'todo'
                            ? 'bg-stone-700 text-white'
                            : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        To Do
                      </button>
                      <button
                        onClick={() => onUpdateStatus(task.id, { ...task, status: 'in-progress' })}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          task.status === 'in-progress'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        In Progress
                      </button>
                      <button
                        onClick={() => onUpdateStatus(task.id, { ...task, status: 'completed' })}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          task.status === 'completed'
                            ? 'bg-green-600 text-white'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        Completed
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => onEdit(task)}
                      className="text-stone-600 hover:text-amber-600 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => onDelete(task.id)}
                      className="text-stone-600 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Team View Component
function TeamView({ teamMembers, tasks, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-stone-900">Team Members</h2>
        <button
          onClick={onAdd}
          className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus size={20} />
          <span>Add Team Member</span>
        </button>
      </div>

      {teamMembers.length === 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 p-12 text-center">
          <User size={48} className="mx-auto text-stone-300 mb-4" />
          <h3 className="text-xl font-semibold text-stone-900 mb-2">No team members yet</h3>
          <p className="text-stone-600 mb-4">Add your team members to assign tasks.</p>
          <button
            onClick={onAdd}
            className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Add Your First Team Member
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.map(member => {
            const assignedTasks = tasks.filter(t => t.assignedTo === member.id);
            const activeTasks = assignedTasks.filter(t => t.status !== 'completed');
            
            return (
              <div key={member.id} className="bg-white rounded-lg border border-stone-200 p-6 shadow-sm task-card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">{member.name}</h3>
                    <p className="text-stone-600">{member.role}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(member)}
                      className="text-stone-600 hover:text-amber-600 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => onDelete(member.id)}
                      className="text-stone-600 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                {member.email && (
                  <p className="text-sm text-stone-600 mb-4">✉️ {member.email}</p>
                )}
                
                <div className="border-t border-stone-200 pt-4 mt-4">
                  <div className="text-sm text-stone-600">
                    <div className="font-semibold mb-1">Assigned Tasks:</div>
                    <div>{activeTasks.length} active, {assignedTasks.length - activeTasks.length} completed</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Utility Components
function StatCard({ label, value, icon: Icon, color }) {
  const colorClasses = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200'
  };
  
  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]} shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{label}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <Icon size={40} className="opacity-50" />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const statusConfig = {
    'todo': { label: 'To Do', class: 'bg-stone-100 text-stone-700' },
    'in-progress': { label: 'In Progress', class: 'bg-blue-100 text-blue-700' },
    'completed': { label: 'Completed', class: 'bg-green-100 text-green-700' },
    'planning': { label: 'Planning', class: 'bg-purple-100 text-purple-700' },
    'active': { label: 'Active', class: 'bg-blue-100 text-blue-700' },
    'on-hold': { label: 'On Hold', class: 'bg-yellow-100 text-yellow-700' }
  };
  
  const config = statusConfig[status] || { label: status, class: 'bg-stone-100 text-stone-700' };
  
  return (
    <span className={`status-badge px-3 py-1 rounded-full text-xs font-semibold ${config.class}`}>
      {config.label}
    </span>
  );
}

// Modal Components
function ClientModal({ client, onSave, onClose }) {
  const [formData, setFormData] = useState(client || {
    name: '',
    company: '',
    email: '',
    phone: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a client name');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-stone-900 mb-4">
          {client ? 'Edit Client' : 'Add New Client'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Client Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="John Doe"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Company
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Acme Corp"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="john@acme.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="(555) 123-4567"
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Save Client
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-700 px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectModal({ project, clients, onSave, onClose }) {
  const [formData, setFormData] = useState(project || {
    name: '',
    description: '',
    clientId: '',
    status: 'planning',
    startDate: '',
    endDate: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a project name');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-stone-900 mb-4">
          {project ? 'Edit Project' : 'Add New Project'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Q4 Implementation"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Project details..."
              rows="3"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Client
            </label>
            <select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select a client (optional)</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Save Project
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-700 px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskModal({ task, projects, clients, teamMembers, onSave, onClose }) {
  const [formData, setFormData] = useState(task || {
    title: '',
    description: '',
    projectId: '',
    assignedTo: '',
    status: 'todo',
    dueDate: ''
  });

  const selectedProject = projects.find(p => p.id === formData.projectId);
  const selectedClient = selectedProject ? clients.find(c => c.id === selectedProject.clientId) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Please enter a task title');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-stone-900 mb-4">
          {task ? 'Edit Task' : 'Add New Task'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Complete onboarding"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Task details..."
              rows="3"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Project
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select a project (optional)</option>
              {projects.map(project => {
                const client = clients.find(c => c.id === project.clientId);
                return (
                  <option key={project.id} value={project.id}>
                    {project.name} {client ? `(${client.name})` : ''}
                  </option>
                );
              })}
            </select>
            {selectedClient && (
              <p className="text-xs text-stone-500 mt-1">Client: {selectedClient.name}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Assign To
            </label>
            <select
              value={formData.assignedTo}
              onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Unassigned</option>
              {teamMembers.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Save Task
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-700 px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TeamModal({ member, onSave, onClose }) {
  const [formData, setFormData] = useState(member || {
    name: '',
    role: '',
    email: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('TeamModal handleSubmit called');
    
    if (!formData.name.trim()) {
      alert('Please enter a team member name');
      return;
    }
    
    setIsSaving(true);
    console.log('Calling onSave with data:', formData);
    
    try {
      await onSave(formData);
      console.log('onSave completed');
    } catch (error) {
      console.error('Error in onSave:', error);
      alert('Error saving team member. Please check the console.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-stone-900 mb-4">
          {member ? 'Edit Team Member' : 'Add New Team Member'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Jane Smith"
              required
              disabled={isSaving}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Role
            </label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Customer Success Manager"
              disabled={isSaving}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="jane@company.com"
              disabled={isSaving}
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Team Member'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}