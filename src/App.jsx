import React, { useState, useEffect, useRef } from 'react';
import { Plus, Users, FolderKanban, CheckSquare, LayoutDashboard, Edit2, Trash2, Clock, AlertCircle, CheckCircle, User, Calendar, Trello, BarChart3, ExternalLink, Menu, X, ChevronDown, ChevronRight, ChevronLeft, List, BookOpen, FileText, Link, Download, Upload, Table, PieChart, TrendingUp, Filter, Circle, Sun, LogOut, Copy } from 'lucide-react';
import { supabase } from './supabaseClient';

// PBB Template Definition
const PBB_TEMPLATE = {
  phases: [
    {
      id: 'phase1',
      name: 'Pre-Planning and Preparation',
      order: 1,
      tasks: [
        'Pre-Planning Meeting',
        'Send User Template',
        'Provide Access to the Tools',
        'Provide Welcome Email',
        'Budget Data Request',
        'Budget Data Upload',
        'Super User Training',
        'Schedule Project Kick-Off Meeting'
      ]
    },
    {
      id: 'phase2',
      name: 'PBB Data Development',
      order: 2,
      sections: [
        {
          id: 'inventory',
          name: 'Program Inventory',
          tasks: [
            'Run Predicted Inventory',
            'Program Inventory Training',
            'Program Inventory Office Hours',
            'Draft Program Inventory Submission',
            'Review and Feedback',
            'Final Program Inventory Submission'
          ]
        },
        {
          id: 'cost-allocation',
          name: 'Program Cost Allocation',
          tasks: [
            'Run Predicted Cost Allocations',
            'Cost Allocation Training',
            'Cost Allocation Office Hours',
            'Draft Cost Allocation Submission',
            'Review and Feedback',
            'Final Cost Allocation Submission'
          ]
        },
        {
          id: 'scoring',
          name: 'Program Scoring',
          tasks: [
            'Run Predicted Scores',
            'Program Scoring Training',
            'Program Scoring Office Hours',
            'Draft Program Scoring Review',
            'Peer Review Training',
            'Peer Review',
            'Final Program Scoring Submission'
          ]
        }
      ]
    },
    {
      id: 'phase3',
      name: 'Insights and Analysis',
      order: 3,
      tasks: [
        'Produce Insight Report',
        'Produce Benchmark Analysis',
        'Produce PBB Impact Matrix',
        'Load Data into PBB Apps'
      ]
    }
  ]
};

// Task priority levels (linear scale, theme-safe accent colors)
const PRIORITIES = {
  urgent: { label: 'Urgent', badge: 'bg-red-100 text-red-700 border border-red-200', dot: 'bg-red-500' },
  high:   { label: 'High',   badge: 'bg-orange-100 text-orange-700 border border-orange-200', dot: 'bg-orange-500' },
  medium: { label: 'Medium', badge: 'bg-brand-100 text-brand-700 border border-brand-200', dot: 'bg-brand-500' },
  low:    { label: 'Low',    badge: 'bg-gray-100 text-gray-600 border border-gray-200', dot: 'bg-gray-400' }
};
const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];
const priorityRank = (p) => {
  const i = PRIORITY_ORDER.indexOf(p);
  return i === -1 ? PRIORITY_ORDER.indexOf('medium') : i;
};

function PriorityBadge({ priority }) {
  const p = PRIORITIES[priority];
  if (!p) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${p.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`}></span>{p.label}
    </span>
  );
}

// Kanban board columns (task statuses). The three built-ins are protected;
// users can add/remove custom columns. Persisted in localStorage.
const DEFAULT_COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'gray', builtin: true },
  { id: 'in-progress', label: 'In Progress', color: 'blue', builtin: true },
  { id: 'completed', label: 'Completed', color: 'green', builtin: true }
];
const COLUMN_COLORS = {
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-brand-100 text-brand-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
  teal: 'bg-teal-100 text-teal-700',
  pink: 'bg-pink-100 text-pink-700'
};
const COLUMN_COLOR_CYCLE = ['blue', 'orange', 'teal', 'green', 'pink', 'purple'];
// Solid fills for progress bars (Analytics), keyed by column color
const COLUMN_BAR_COLORS = {
  gray: 'bg-gray-600', blue: 'bg-brand-600', green: 'bg-green-600',
  purple: 'bg-purple-600', orange: 'bg-orange-600', teal: 'bg-teal-600', pink: 'bg-pink-600'
};
// Board columns live per-workspace in the DB. This module cache is hydrated from
// the workspace's board_columns on load, so the many synchronous callers
// (StatusBadge, filters, TaskModal, Analytics) can keep reading it as before.
let boardColumnsCache = DEFAULT_COLUMNS;
const loadBoardColumns = () => boardColumnsCache;
const setBoardColumnsCache = (cols) => {
  boardColumnsCache = (Array.isArray(cols) && cols.length) ? cols : DEFAULT_COLUMNS;
};

// Calendar event types — availability (who's out) + client events. Full literal
// class strings so Tailwind's CDN JIT always emits them. No purple (theme convention).
const EVENT_TYPES = {
  time_off:       { label: 'Time Off',       cat: 'avail',  chip: 'bg-amber-100 text-amber-800 border border-amber-200', dot: 'bg-amber-500' },
  travel:         { label: 'Travel',         cat: 'avail',  chip: 'bg-blue-100 text-blue-800 border border-blue-200',    dot: 'bg-blue-500' },
  sick:           { label: 'Sick',           cat: 'avail',  chip: 'bg-red-100 text-red-800 border border-red-200',       dot: 'bg-red-500' },
  holiday:        { label: 'Holiday',        cat: 'avail',  chip: 'bg-gray-100 text-gray-700 border border-gray-200',    dot: 'bg-gray-400' },
  client_meeting: { label: 'Client Meeting', cat: 'client', chip: 'bg-green-100 text-green-800 border border-green-200', dot: 'bg-green-500' },
  training:       { label: 'Training',       cat: 'client', chip: 'bg-brand-100 text-brand-800 border border-brand-200', dot: 'bg-brand-500' },
  other:          { label: 'Other',          cat: 'client', chip: 'bg-slate-100 text-slate-700 border border-slate-200', dot: 'bg-slate-400' }
};
const EVENT_TYPE_ORDER = ['time_off', 'travel', 'sick', 'holiday', 'client_meeting', 'training', 'other'];
const eventTypeMeta = (t) => EVENT_TYPES[t] || EVENT_TYPES.other;

// Date helpers — parse 'YYYY-MM-DD' strings as LOCAL midnight to avoid the UTC
// off-by-one that new Date('YYYY-MM-DD') causes in timezones behind UTC.
const parseLocalDate = (s) => (s ? new Date(s + 'T00:00:00') : null);
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isTaskOverdue = (task) => !!task.dueDate && task.status !== 'completed' && parseLocalDate(task.dueDate) < startOfToday();

// ===== Supabase row <-> app object mappers =====
// The DB uses snake_case; the app/components use camelCase. These keep the
// components unchanged while persisting to Postgres. nz() turns '' into null
// so empty date/uuid fields don't violate column types.
const nz = (v) => (v === '' || v === undefined ? null : v);

const dbToClient = (r) => ({
  id: r.id, name: r.name || '', company: r.company || '', email: r.email || '', phone: r.phone || '',
  assignedTo: r.assigned_to || '', populationSize: r.population_size || '', yearEndDate: r.year_end_date || '',
  valueProposition: r.value_proposition || '', problemIssue: r.problem_issue || '',
  goalMetric: r.goal_metric || '', expectedDeliverables: r.expected_deliverables || ''
});
const clientToDb = (c) => ({
  name: c.name || '', company: nz(c.company), email: nz(c.email), phone: nz(c.phone),
  assigned_to: nz(c.assignedTo), population_size: nz(c.populationSize), year_end_date: nz(c.yearEndDate),
  value_proposition: nz(c.valueProposition), problem_issue: nz(c.problemIssue),
  goal_metric: nz(c.goalMetric), expected_deliverables: nz(c.expectedDeliverables)
});

const dbToProject = (r) => ({
  id: r.id, name: r.name || '', clientId: r.client_id || '', status: r.status || 'planning',
  startDate: r.start_date || '', endDate: r.end_date || '', description: r.description || '',
  usePBBTemplate: !!r.use_pbb_template
});
const projectToDb = (p) => ({
  name: p.name || '', client_id: nz(p.clientId), status: p.status || 'planning',
  start_date: nz(p.startDate), end_date: nz(p.endDate), description: nz(p.description),
  use_pbb_template: !!p.usePBBTemplate
});

const dbToTask = (r) => ({
  id: r.id, title: r.title || '', description: r.description || '', projectId: r.project_id || '',
  assignedTo: r.assigned_to || '', status: r.status || 'todo', priority: r.priority || 'medium',
  startDate: r.start_date || '', dueDate: r.due_date || '',
  subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
  phase: r.phase || '', phaseName: r.phase_name || '', section: r.section || '', sectionName: r.section_name || '',
  order: r.sort_order || 0
});
const taskToDb = (t) => ({
  title: t.title || '', description: nz(t.description), project_id: nz(t.projectId), assigned_to: nz(t.assignedTo),
  status: t.status || 'todo', priority: t.priority || 'medium', start_date: nz(t.startDate), due_date: nz(t.dueDate),
  subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
  phase: nz(t.phase), phase_name: nz(t.phaseName), section: nz(t.section), section_name: nz(t.sectionName),
  sort_order: t.order || 0
});

const dbToTeam = (r) => ({ id: r.id, name: r.name || '', role: r.role || '', email: r.email || '' });
const teamToDb = (m) => ({ name: m.name || '', role: nz(m.role), email: nz(m.email) });

const dbToLink = (r) => ({ id: r.id, title: r.title || '', url: r.url || '', description: r.description || '', dateAdded: r.date_added || r.created_at });
const linkToDb = (l) => ({ title: l.title || '', url: nz(l.url), description: nz(l.description) });

const dbToEvent = (r) => ({
  id: r.id, title: r.title || '', eventType: r.event_type || 'time_off',
  memberId: r.member_id || '', clientId: r.client_id || '',
  startDate: r.start_date || '', endDate: r.end_date || '',
  allDay: r.all_day !== false, startTime: r.start_time || '', endTime: r.end_time || '',
  notes: r.notes || ''
});
const eventToDb = (e) => ({
  title: e.title || '', event_type: e.eventType || 'time_off',
  member_id: nz(e.memberId), client_id: nz(e.clientId),
  start_date: nz(e.startDate), end_date: nz(e.endDate),
  all_day: e.allDay !== false, start_time: nz(e.startTime), end_time: nz(e.endTime),
  notes: nz(e.notes)
});

// Catches render errors so a crash in one view (or a bad localStorage record)
// shows a recoverable message instead of a blank white screen.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('Caught by ErrorBoundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-8">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 max-w-md text-center">
            <AlertCircle size={40} className="mx-auto text-red-500 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h3>
            <p className="text-gray-600 mb-4">This section ran into an unexpected error. Your saved data is safe.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Login / signup screen (email + password)
function AuthScreen({ joining }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim(), workspace_name: workspaceName.trim() || 'My Workspace' } }
        });
        if (error) throw error;
        if (!data.session) {
          setNotice('Account created. Check your email to confirm, then sign in.');
          setMode('signin');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl text-gray-900" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>📋 Joan</h1>
        </div>
        {joining && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-brand-50 border border-brand-200 text-sm text-brand-800 text-center">
            You've been invited to a workspace — sign in or create an account to join.
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
          <p className="text-sm text-gray-500 mb-6">{mode === 'signup' ? 'Start a new workspace.' : 'Sign in to your workspace.'}</p>

          {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
          {notice && <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{notice}</div>}

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Jesse Muñiz"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Workspace name</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={e => setWorkspaceName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Muniz Consulting Group"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
            >
              {busy ? 'Please wait…' : (mode === 'signup' ? 'Create account' : 'Sign in')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setNotice(null); }}
              className="text-brand-600 hover:text-brand-700 font-medium"
            >
              {mode === 'signup' ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Root: gates the app behind authentication
export default function AppRoot() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [joinToken] = useState(() => new URLSearchParams(window.location.search).get('join'));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) return <AuthScreen joining={!!joinToken} />;

  return <ClientProjectManager session={session} onSignOut={() => supabase.auth.signOut()} joinToken={joinToken} />;
}

function ClientProjectManager({ session, onSignOut, joinToken }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  const [members, setMembers] = useState([]);
  const [wsInvites, setWsInvites] = useState([]);
  const [linkInvites, setLinkInvites] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [boardColumns, setBoardColumns] = useState(DEFAULT_COLUMNS);
  const [joinPreview, setJoinPreview] = useState(null);
  const joinCheckedRef = useRef(false);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [resources, setResources] = useState({ links: [] });
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  // Modal states
  const [showClientModal, setShowClientModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showProjectDetailModal, setShowProjectDetailModal] = useState(false);
  const [showClientDetailModal, setShowClientDetailModal] = useState(false);
  const [showCalendarEventModal, setShowCalendarEventModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Storage helper - uses localStorage
  // Generate PBB template tasks for a project
  const generatePBBTasks = (projectId) => {
    const newTasks = [];
    const baseTime = Date.now();

    PBB_TEMPLATE.phases.forEach((phase, phaseIndex) => {
      if (phase.sections) {
        // Phase 2 with sections
        phase.sections.forEach((section, sectionIndex) => {
          section.tasks.forEach((taskTitle, taskIndex) => {
            newTasks.push({
              id: `${baseTime}-${phaseIndex}-${sectionIndex}-${taskIndex}`,
              title: taskTitle,
              description: '',
              projectId: projectId,
              assignedTo: '',
              status: 'todo',
              dueDate: '',
              phase: phase.id,
              phaseName: phase.name,
              section: section.id,
              sectionName: section.name,
              order: taskIndex
            });
          });
        });
      } else {
        // Phase 1 or 3 without sections
        phase.tasks.forEach((taskTitle, taskIndex) => {
          newTasks.push({
            id: `${baseTime}-${phaseIndex}-${taskIndex}`,
            title: taskTitle,
            description: '',
            projectId: projectId,
            assignedTo: '',
            status: 'todo',
            dueDate: '',
            phase: phase.id,
            phaseName: phase.name,
            section: null,
            sectionName: null,
            order: taskIndex
          });
        });
      }
    });

    return newTasks;
  };

  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Current workspace (derived) + the caller's role in it
  const workspace = workspaces.find(w => w.id === currentWorkspaceId) || null;
  const myRole = workspace?.role || 'member';
  const canManageAccess = myRole === 'owner' || myRole === 'admin';

  // On login: load all workspaces the user belongs to, plus any pending invites
  useEffect(() => {
    if (!session?.user) return;
    loadWorkspaces();
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Reload workspace data whenever the active workspace changes
  useEffect(() => {
    if (currentWorkspaceId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspaceId]);

  const loadWorkspaces = async () => {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces(name)')
      .eq('user_id', session.user.id);
    if (error || !data) {
      console.error('Workspace load failed:', error);
      showNotification('Could not load your workspaces.', 'error');
      setLoading(false);
      return;
    }
    const ws = data
      .filter(r => r.workspaces)
      .map(r => ({ id: r.workspace_id, name: r.workspaces.name || 'Workspace', role: r.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setWorkspaces(ws);
    const saved = localStorage.getItem('current-workspace');
    const pick = ws.find(w => w.id === saved) || ws[0];
    if (pick) setCurrentWorkspaceId(pick.id);
    else setLoading(false);
  };

  const loadInvites = async () => {
    const email = (session.user.email || '').toLowerCase();
    const { data } = await supabase
      .from('invites')
      .select('id, role, workspace_id, workspace_name')
      .eq('status', 'pending')
      .eq('email', email);
    setPendingInvites(data || []);
  };

  const switchWorkspace = (id) => {
    if (id === currentWorkspaceId) return;
    localStorage.setItem('current-workspace', id);
    setCurrentWorkspaceId(id);
    setActiveTab('dashboard');
  };

  const loadData = async () => {
    const wsId = currentWorkspaceId;
    if (!wsId) { setLoading(false); return; }
    localStorage.setItem('current-workspace', wsId);
    try {
      const [c, p, t, tm, r, mem, inv, bc, ev] = await Promise.all([
        supabase.from('clients').select('*').eq('workspace_id', wsId),
        supabase.from('projects').select('*').eq('workspace_id', wsId),
        supabase.from('tasks').select('*').eq('workspace_id', wsId),
        supabase.from('team_members').select('*').eq('workspace_id', wsId),
        supabase.from('resources').select('*').eq('workspace_id', wsId),
        supabase.from('workspace_members').select('id, user_id, email, name, role').eq('workspace_id', wsId),
        supabase.from('invites').select('id, email, role, token, created_at').eq('workspace_id', wsId).eq('status', 'pending'),
        supabase.from('board_columns').select('columns').eq('workspace_id', wsId).maybeSingle(),
        supabase.from('calendar_events').select('*').eq('workspace_id', wsId)
      ]);
      const firstErr = c.error || p.error || t.error || tm.error || r.error || mem.error || inv.error || ev.error;
      if (firstErr) throw firstErr;
      const cols = (Array.isArray(bc.data?.columns) && bc.data.columns.length) ? bc.data.columns : DEFAULT_COLUMNS;
      setBoardColumns(cols);
      setBoardColumnsCache(cols);
      setClients((c.data || []).map(dbToClient));
      setProjects((p.data || []).map(dbToProject));
      setTasks((t.data || []).map(dbToTask));
      setTeamMembers((tm.data || []).map(dbToTeam));
      setCalendarEvents((ev.data || []).map(dbToEvent));
      setResources({ links: (r.data || []).map(dbToLink) });
      setMembers(mem.data || []);
      const allInvites = inv.data || [];
      setWsInvites(allInvites.filter(i => i.email));      // email invites
      setLinkInvites(allInvites.filter(i => i.token && !i.email)); // shareable links
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Error loading your data. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const dbError = (msg, error) => { console.error(msg, error); showNotification(msg, 'error'); };

  // Workspace access (invites, members, roles)
  const inviteMember = async (email, role) => {
    const e = (email || '').trim().toLowerCase();
    if (!e) return;
    if (members.some(m => (m.email || '').toLowerCase() === e)) return showNotification('That person is already a member.', 'error');
    if (wsInvites.some(i => (i.email || '').toLowerCase() === e)) return showNotification('An invite is already pending for that email.', 'error');
    const { error } = await supabase.from('invites')
      .insert({ workspace_id: workspace.id, workspace_name: workspace.name, email: e, role, invited_by: session.user.id });
    if (error) return dbError('Could not create the invite (owners/admins only).', error);
    showNotification('Invitation created.');
    loadData();
  };

  const revokeInvite = async (id) => {
    const { error } = await supabase.from('invites').delete().eq('id', id);
    if (error) return dbError('Could not revoke the invite.', error);
    showNotification('Invitation revoked.');
    setWsInvites(prev => prev.filter(i => i.id !== id));
    setLinkInvites(prev => prev.filter(i => i.id !== id));
  };

  const createInviteLink = async (role) => {
    const token = crypto.randomUUID();
    const { error } = await supabase.from('invites').insert({
      workspace_id: workspace.id, workspace_name: workspace.name, email: null, role, token, invited_by: session.user.id
    });
    if (error) return dbError('Could not create the invite link (owners/admins only).', error);
    showNotification('Invite link created.');
    loadData();
  };

  const copyInviteLink = async (token) => {
    const url = `${window.location.origin}/?join=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      showNotification('Invite link copied to clipboard!');
    } catch {
      showNotification('Could not copy — link: ' + url, 'error');
    }
  };

  const clearJoinUrl = () => window.history.replaceState({}, '', window.location.pathname);

  const acceptJoinLink = async () => {
    if (!joinPreview) return;
    const { data, error } = await supabase.rpc('accept_invite_by_token', { p_token: joinPreview.token });
    setJoinPreview(null);
    clearJoinUrl();
    if (error) return dbError('Could not join via that link.', error);
    showNotification('Joined workspace!');
    await loadWorkspaces();
    if (data) switchWorkspace(data);
  };

  // If arriving via an invite link, look it up and prompt to join
  useEffect(() => {
    if (!joinToken || !session?.user || joinCheckedRef.current) return;
    joinCheckedRef.current = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_invite_by_token', { p_token: joinToken });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        showNotification('That invite link is invalid or was revoked.', 'error');
        clearJoinUrl();
        return;
      }
      setJoinPreview({ ...row, token: joinToken });
    })();
  }, [joinToken, session]);

  const removeMember = async (memberRowId) => {
    if (!confirm('Remove this person from the workspace? They will lose access.')) return;
    const { error } = await supabase.from('workspace_members').delete().eq('id', memberRowId);
    if (error) return dbError('Could not remove the member.', error);
    showNotification('Member removed.');
    setMembers(prev => prev.filter(m => m.id !== memberRowId));
  };

  const acceptInvite = async (invite) => {
    const { error } = await supabase.rpc('accept_invite', { p_invite_id: invite.id });
    if (error) return dbError('Could not accept the invitation.', error);
    showNotification('Invitation accepted!');
    setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
    await loadWorkspaces();
    switchWorkspace(invite.workspace_id);
  };

  const declineInvite = (inviteId) => {
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
  };

  const persistBoardColumns = async (cols) => {
    setBoardColumns(cols);
    setBoardColumnsCache(cols);
    const { error } = await supabase.from('board_columns')
      .upsert({ workspace_id: workspace.id, columns: cols, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
    if (error) dbError('Could not save the board columns.', error);
  };

  // Resource functions - Links only
  const addLink = async (link) => {
    const { data, error } = await supabase.from('resources')
      .insert({ ...linkToDb(link), workspace_id: workspace.id }).select().single();
    if (error) return dbError('Error saving link. Please try again.', error);
    setResources(prev => ({ ...prev, links: [...prev.links, dbToLink(data)] }));
    showNotification('Link added successfully!');
  };

  const updateLink = async (id, updatedLink) => {
    const { data, error } = await supabase.from('resources').update(linkToDb(updatedLink)).eq('id', id).select().single();
    if (error) return dbError('Error saving link. Please try again.', error);
    setResources(prev => ({ ...prev, links: prev.links.map(l => l.id === id ? dbToLink(data) : l) }));
    showNotification('Link updated successfully!');
  };

  const deleteLink = async (id) => {
    if (!confirm('Delete this link?')) return;
    const { error } = await supabase.from('resources').delete().eq('id', id);
    if (error) return dbError('Error deleting link. Please try again.', error);
    setResources(prev => ({ ...prev, links: prev.links.filter(l => l.id !== id) }));
    showNotification('Link deleted successfully!');
  };

  // Client functions
  const addClient = async (client) => {
    const { data, error } = await supabase.from('clients')
      .insert({ ...clientToDb(client), workspace_id: workspace.id }).select().single();
    if (error) return dbError('Error saving client. Please try again.', error);
    setClients(prev => [...prev, dbToClient(data)]);
    showNotification('Client added successfully!');
  };

  const updateClient = async (id, updatedClient) => {
    const { data, error } = await supabase.from('clients').update(clientToDb(updatedClient)).eq('id', id).select().single();
    if (error) return dbError('Error saving client. Please try again.', error);
    setClients(prev => prev.map(c => c.id === id ? dbToClient(data) : c));
    showNotification('Client updated successfully!');
  };

  const deleteClient = async (id) => {
    if (!confirm('Delete this client? Associated projects and tasks will remain but won\'t be linked.')) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) return dbError('Error deleting client. Please try again.', error);
    setClients(prev => prev.filter(c => c.id !== id));
    setProjects(prev => prev.map(p => p.clientId === id ? { ...p, clientId: '' } : p)); // DB SET NULL
    showNotification('Client deleted successfully!');
  };

  // Project functions
  const addProject = async (project, usePBBTemplate = false) => {
    const { data, error } = await supabase.from('projects')
      .insert({ ...projectToDb(project), use_pbb_template: usePBBTemplate, workspace_id: workspace.id })
      .select().single();
    if (error) return dbError('Error saving project. Please try again.', error);
    const newProject = dbToProject(data);
    setProjects(prev => [...prev, newProject]);

    if (usePBBTemplate) {
      const rows = generatePBBTasks(newProject.id).map(t => ({ ...taskToDb(t), workspace_id: workspace.id }));
      const { data: taskData, error: taskErr } = await supabase.from('tasks').insert(rows).select();
      if (taskErr) return dbError('Project created, but template tasks failed to save.', taskErr);
      setTasks(prev => [...prev, ...(taskData || []).map(dbToTask)]);
      showNotification(`Project created with ${(taskData || []).length} PBB template tasks!`);
    } else {
      showNotification('Project added successfully!');
    }
  };

  const updateProject = async (id, updatedProject) => {
    const { data, error } = await supabase.from('projects').update(projectToDb(updatedProject)).eq('id', id).select().single();
    if (error) return dbError('Error saving project. Please try again.', error);
    setProjects(prev => prev.map(p => p.id === id ? dbToProject(data) : p));
    showNotification('Project updated successfully!');
  };

  const deleteProject = async (id) => {
    if (!confirm('Delete this project? Associated tasks will remain but won\'t be linked.')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return dbError('Error deleting project. Please try again.', error);
    setProjects(prev => prev.filter(p => p.id !== id));
    setTasks(prev => prev.map(t => t.projectId === id ? { ...t, projectId: '' } : t)); // DB SET NULL
    showNotification('Project deleted successfully!');
  };

  // Task functions
  const addTask = async (task) => {
    const { data, error } = await supabase.from('tasks')
      .insert({ ...taskToDb(task), workspace_id: workspace.id }).select().single();
    if (error) return dbError('Error saving task. Please try again.', error);
    setTasks(prev => [...prev, dbToTask(data)]);
    showNotification('Task added successfully!');
  };

  const updateTask = async (id, updatedTask) => {
    const { data, error } = await supabase.from('tasks').update(taskToDb(updatedTask)).eq('id', id).select().single();
    if (error) return dbError('Error saving task. Please try again.', error);
    setTasks(prev => prev.map(t => t.id === id ? dbToTask(data) : t));
    showNotification('Task updated successfully!');
  };

  const deleteTask = async (id) => {
    if (!confirm('Delete this task?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) return dbError('Error deleting task. Please try again.', error);
    setTasks(prev => prev.filter(t => t.id !== id));
    showNotification('Task deleted successfully!');
  };

  // Calendar event functions
  const addCalendarEvent = async (ev) => {
    const { data, error } = await supabase.from('calendar_events')
      .insert({ ...eventToDb(ev), workspace_id: workspace.id, created_by: session.user.id }).select().single();
    if (error) return dbError('Error saving event. Please try again.', error);
    setCalendarEvents(prev => [...prev, dbToEvent(data)]);
    showNotification('Event added successfully!');
  };

  const updateCalendarEvent = async (id, updatedEvent) => {
    const { data, error } = await supabase.from('calendar_events').update(eventToDb(updatedEvent)).eq('id', id).select().single();
    if (error) return dbError('Error saving event. Please try again.', error);
    setCalendarEvents(prev => prev.map(e => e.id === id ? dbToEvent(data) : e));
    showNotification('Event updated successfully!');
  };

  const deleteCalendarEvent = async (id) => {
    if (!confirm('Delete this event?')) return;
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) return dbError('Error deleting event. Please try again.', error);
    setCalendarEvents(prev => prev.filter(e => e.id !== id));
    showNotification('Event deleted successfully!');
  };

  // Team functions
  const addTeamMember = async (member) => {
    const { data, error } = await supabase.from('team_members')
      .insert({ ...teamToDb(member), workspace_id: workspace.id }).select().single();
    if (error) return dbError('Error saving team member. Please try again.', error);
    setTeamMembers(prev => [...prev, dbToTeam(data)]);
    showNotification('Team member added successfully!');
  };

  const updateTeamMember = async (id, updatedMember) => {
    const { data, error } = await supabase.from('team_members').update(teamToDb(updatedMember)).eq('id', id).select().single();
    if (error) return dbError('Error saving team member. Please try again.', error);
    setTeamMembers(prev => prev.map(m => m.id === id ? dbToTeam(data) : m));
    showNotification('Team member updated successfully!');
  };

  const deleteTeamMember = async (id) => {
    if (!confirm('Delete this team member?')) return;
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) return dbError('Error deleting team member. Please try again.', error);
    setTeamMembers(prev => prev.filter(m => m.id !== id));
    // DB SET NULL on assigned_to — clear locally so assignments update immediately
    setClients(prev => prev.map(c => c.assignedTo === id ? { ...c, assignedTo: '' } : c));
    setTasks(prev => prev.map(t => t.assignedTo === id ? { ...t, assignedTo: '' } : t));
    showNotification('Team member deleted successfully!');
  };

  const [expandedMenuItems, setExpandedMenuItems] = useState({ projects: true });

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'mytasks', label: 'Today', icon: Sun },
    { id: 'clients', label: 'Clients', icon: Users },
    { 
      id: 'projects', 
      label: 'Projects', 
      icon: FolderKanban,
      subItems: [
        { id: 'kanban', label: 'Kanban Board', icon: Trello },
        { id: 'gantt', label: 'Gantt Chart', icon: BarChart3 },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        { id: 'table', label: 'Table View', icon: Table },
        { id: 'analytics', label: 'Analytics', icon: PieChart }
      ]
    },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'resources', label: 'Resources', icon: BookOpen },
    { id: 'team', label: 'Team', icon: User }
  ];

  const toggleMenuItem = (itemId) => {
    setExpandedMenuItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-brand-600 rounded-full animate-spin"></div>
        <div className="text-gray-500 text-sm">Loading your workspace…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&family=Playfair+Display:wght@600;700&display=swap');

        * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        h1, h2, h3, h4 {
          font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
          font-weight: 700;
        }

        .joan-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .task-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #e5e7eb;
        }
        
        .task-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          border-color: #d1d5db;
        }
        
        .sidebar-item {
          position: relative;
          transition: all 0.2s ease;
        }
        
        .sidebar-item:hover {
          background: rgba(168, 134, 63, 0.10);
          transform: translateX(4px);
        }

        .sidebar-item.active {
          background: linear-gradient(90deg, rgba(168, 134, 63, 0.16), rgba(193, 159, 79, 0.08));
          border-right: 3px solid #a8863f;
          color: #5c4522;
          font-weight: 600;
        }

        .sidebar-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: linear-gradient(180deg, #a8863f, #8f6f33);
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
          max-height: 90vh;
          overflow-y: auto;
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
        
        .kanban-column {
          min-height: 500px;
        }
        
        .kanban-card {
          cursor: grab;
          transition: all 0.2s ease;
        }
        
        .kanban-card:active {
          cursor: grabbing;
          opacity: 0.5;
        }
        
        .kanban-card.dragging {
          opacity: 0.5;
        }
        
        .kanban-column.drag-over {
          background: rgba(251, 191, 36, 0.1);
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
      <header className="bg-[#1c1a17] shadow-lg fixed top-0 left-0 right-0 z-30 border-b-2 border-[#b8944d]">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-[#f5edd8] hover:text-white transition-colors"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div>
              <h1 className="joan-title text-2xl text-[#f5edd8]">📋 Joan</h1>
            </div>
          </div>
          <div className="hidden sm:block text-sm text-[#a89f8c] font-medium">
            {clients.length} clients • {projects.length} projects • {tasks.length} tasks
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`fixed top-[85px] left-0 bottom-0 w-64 bg-white border-r border-gray-200 shadow-xl transition-transform duration-300 z-20 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <nav className="py-6">
          {navigationItems.map(item => (
            <div key={item.id}>
              {/* Main navigation item */}
              <button
                onClick={() => {
                  if (item.subItems) {
                    // For items with sub-items, navigate to main item AND toggle submenu
                    setActiveTab(item.id);
                    toggleMenuItem(item.id);
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  } else {
                    setActiveTab(item.id);
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }
                }}
                className={`sidebar-item w-full flex items-center justify-between px-6 py-3 text-left ${
                  (activeTab === item.id || (item.subItems && item.subItems.some(sub => sub.id === activeTab)))
                    ? 'active text-brand-700 font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </div>
                {item.subItems && (
                  expandedMenuItems[item.id] 
                    ? <ChevronDown size={16} className="text-gray-400" />
                    : <ChevronRight size={16} className="text-gray-400" />
                )}
              </button>

              {/* Sub-items (if any) */}
              {item.subItems && expandedMenuItems[item.id] && (
                <div className="bg-gray-50">
                  {item.subItems.map(subItem => (
                    <button
                      key={subItem.id}
                      onClick={() => {
                        setActiveTab(subItem.id);
                        if (window.innerWidth < 1024) setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 pl-14 pr-6 py-2.5 text-left transition-colors ${
                        activeTab === subItem.id
                          ? 'bg-brand-100 text-brand-700 font-semibold border-l-4 border-brand-600'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-l-4 border-transparent'
                      }`}
                    >
                      <subItem.icon size={18} />
                      <span className="text-sm">{subItem.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200">
          <div className="px-6 pt-4 text-xs text-gray-500">
            <p className="font-semibold mb-1">Quick Stats</p>
            <p>Active: {tasks.filter(t => t.status !== 'completed').length} tasks</p>
            <p>Team: {teamMembers.length} members</p>
          </div>
          {session?.user && (
            <div className="px-6 py-4 mt-3 border-t border-gray-100 space-y-2">
              {workspaces.length > 1 ? (
                <select
                  value={currentWorkspaceId || ''}
                  onChange={(e) => switchWorkspace(e.target.value)}
                  className="w-full text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  title="Switch workspace"
                >
                  {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              ) : (
                workspace && <p className="text-xs font-semibold text-gray-700 truncate">{workspace.name}</p>
              )}
              <p className="text-xs text-gray-500 truncate">{session.user.email} · <span className="capitalize">{myRole}</span></p>
              <button
                onClick={onSignOut}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`pt-[85px] transition-all duration-300 ${
        sidebarOpen ? 'lg:ml-64' : 'ml-0'
      }`}>
        <div className="p-4 sm:p-8 bg-gray-50 min-h-screen">
          {pendingInvites.length > 0 && (
            <div className="mb-6 space-y-3">
              {pendingInvites.map(inv => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-4 bg-brand-50 border border-brand-200 rounded-lg px-5 py-4">
                  <div className="text-sm text-gray-700">
                    You've been invited to <span className="font-semibold">{inv.workspace_name || 'a workspace'}</span> as <span className="capitalize font-medium">{inv.role}</span>.
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => acceptInvite(inv)} className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">Accept</button>
                    <button onClick={() => declineInvite(inv.id)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <ErrorBoundary key={activeTab}>
          {activeTab === 'dashboard' && (
            <DashboardView
              clients={clients}
              projects={projects}
              tasks={tasks}
              teamMembers={teamMembers}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'mytasks' && (
            <MyTasksView
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

          {activeTab === 'kanban' && (
            <KanbanView
              tasks={tasks}
              projects={projects}
              clients={clients}
              teamMembers={teamMembers}
              columns={boardColumns}
              onColumnsChange={persistBoardColumns}
              onUpdateTask={updateTask}
              onEditTask={(task) => { setEditingItem(task); setShowTaskModal(true); }}
              onAddTask={() => { setEditingItem(null); setShowTaskModal(true); }}
            />
          )}
          
          {activeTab === 'gantt' && (
            <GanttView
              projects={projects}
              tasks={tasks}
              clients={clients}
              onEditProject={(project) => { setEditingItem(project); setShowProjectModal(true); }}
              onEditTask={(task) => { setEditingItem(task); setShowTaskModal(true); }}
            />
          )}
          
          {activeTab === 'clients' && (
            <ClientsView
              clients={clients}
              onAdd={() => { setEditingItem(null); setShowClientModal(true); }}
              onEdit={(client) => { setEditingItem(client); setShowClientModal(true); }}
              onDelete={deleteClient}
              onView={(client) => { setEditingItem(client); setShowClientDetailModal(true); }}
              projects={projects}
              tasks={tasks}
              teamMembers={teamMembers}
              onNavigate={setActiveTab}
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
              onNavigate={setActiveTab}
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

          {activeTab === 'table' && (
            <TableView
              tasks={tasks}
              projects={projects}
              clients={clients}
              teamMembers={teamMembers}
              onEditTask={(task) => { setEditingItem(task); setShowTaskModal(true); }}
              onUpdateStatus={updateTask}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              tasks={tasks}
              projects={projects}
              clients={clients}
              teamMembers={teamMembers}
            />
          )}
          
          {activeTab === 'team' && (
            <div className="space-y-10">
              <WorkspaceAccess
                members={members}
                invites={wsInvites}
                linkInvites={linkInvites}
                currentUserId={session.user.id}
                canManage={canManageAccess}
                onInvite={inviteMember}
                onCreateLink={createInviteLink}
                onCopyLink={copyInviteLink}
                onRevoke={revokeInvite}
                onRemove={removeMember}
              />
              <TeamView
                teamMembers={teamMembers}
                tasks={tasks}
                onAdd={() => { setEditingItem(null); setShowTeamModal(true); }}
                onEdit={(member) => { setEditingItem(member); setShowTeamModal(true); }}
                onDelete={deleteTeamMember}
              />
            </div>
          )}

          {activeTab === 'calendar' && (
            <CalendarEventsView
              calendarEvents={calendarEvents}
              teamMembers={teamMembers}
              clients={clients}
              onAdd={() => { setEditingItem(null); setShowCalendarEventModal(true); }}
              onEdit={(ev) => { setEditingItem(ev); setShowCalendarEventModal(true); }}
              onDelete={deleteCalendarEvent}
            />
          )}

          {activeTab === 'resources' && (
            <ResourcesView
              resources={resources}
              onAddLink={addLink}
              onEditLink={updateLink}
              onDeleteLink={deleteLink}
            />
          )}
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Join-via-link confirmation */}
      {joinPreview && (
        <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="modal-content bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center mx-auto mb-4">
              <Users size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Join workspace</h2>
            <p className="text-gray-600 mb-6">
              You've been invited to join <span className="font-semibold">{joinPreview.workspace_name}</span> as <span className="capitalize font-medium">{joinPreview.role}</span>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={acceptJoinLink}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Join workspace
              </button>
              <button
                onClick={() => { setJoinPreview(null); clearJoinUrl(); }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showClientModal && (
        <ClientModal
          client={editingItem}
          teamMembers={teamMembers}
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

      {showClientDetailModal && editingItem && (
        <ClientDetailView
          client={editingItem}
          teamMembers={teamMembers}
          onClose={() => {
            setShowClientDetailModal(false);
            setEditingItem(null);
          }}
          onEdit={() => {
            setShowClientDetailModal(false);
            setShowClientModal(true);
          }}
        />
      )}

      {showProjectModal && (
        <ProjectModal
          project={editingItem}
          clients={clients}
          onSave={(project, usePBBTemplate) => {
            if (editingItem) {
              updateProject(editingItem.id, project);
            } else {
              addProject(project, usePBBTemplate);
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

      {showCalendarEventModal && (
        <CalendarEventModal
          event={editingItem}
          teamMembers={teamMembers}
          clients={clients}
          onDelete={deleteCalendarEvent}
          onSave={(ev) => {
            if (editingItem) {
              updateCalendarEvent(editingItem.id, ev);
            } else {
              addCalendarEvent(ev);
            }
            setShowCalendarEventModal(false);
            setEditingItem(null);
          }}
          onClose={() => { setShowCalendarEventModal(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

// ... (rest of the components from the previous version remain exactly the same)
// Kanban View Component
function KanbanView({ tasks, projects, clients, teamMembers, columns, onColumnsChange, onUpdateTask, onEditTask, onAddTask }) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingColId, setEditingColId] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');

  const startRename = (col) => { setEditingColId(col.id); setEditingLabel(col.label); };
  const cancelRename = () => { setEditingColId(null); setEditingLabel(''); };
  const commitRename = () => {
    const label = editingLabel.trim();
    if (label) onColumnsChange(columns.map(c => c.id === editingColId ? { ...c, label } : c));
    setEditingColId(null);
    setEditingLabel('');
  };

  const moveColumn = (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= columns.length) return;
    const next = [...columns];
    [next[index], next[j]] = [next[j], next[index]];
    onColumnsChange(next);
  };

  const addColumn = () => {
    const label = newColumnName.trim();
    if (!label) return;
    const id = `col-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${Date.now()}`;
    const color = COLUMN_COLOR_CYCLE[columns.filter(c => !c.builtin).length % COLUMN_COLOR_CYCLE.length];
    onColumnsChange([...columns, { id, label, color, builtin: false }]);
    setNewColumnName('');
  };

  const deleteColumn = (col) => {
    const affected = tasks.filter(t => t.status === col.id);
    const msg = affected.length > 0
      ? `Delete "${col.label}"? Its ${affected.length} task${affected.length === 1 ? '' : 's'} will move back to "To Do".`
      : `Delete the "${col.label}" column?`;
    if (!confirm(msg)) return;
    affected.forEach(t => onUpdateTask(t.id, { ...t, status: 'todo' }));
    onColumnsChange(columns.filter(c => c.id !== col.id));
  };

  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== newStatus) {
      onUpdateTask(draggedTask.id, { ...draggedTask, status: newStatus });
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Kanban Board</h2>
        <button
          onClick={onAddTask}
          className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus size={20} />
          <span>Add Task</span>
        </button>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-2">
        {columns.map((column, idx) => {
          const columnTasks = tasks.filter(t => t.status === column.id);
          const isEditing = editingColId === column.id;

          return (
            <div
              key={column.id}
              className={`kanban-column group bg-white rounded-lg border-2 p-4 w-80 flex-shrink-0 ${
                dragOverColumn === column.id ? 'drag-over border-brand-400' : 'border-gray-200'
              }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingLabel}
                      autoFocus
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                        if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                      }}
                      className="w-full text-lg font-bold text-gray-900 border-b-2 border-brand-400 focus:outline-none bg-transparent"
                    />
                  ) : (
                    <h3
                      className="text-xl font-bold text-gray-900 truncate cursor-text"
                      title="Double-click to rename"
                      onDoubleClick={() => startRename(column)}
                    >
                      {column.label}
                    </h3>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold flex-shrink-0 ${COLUMN_COLORS[column.color] || 'bg-gray-100 text-gray-700'}`}>
                  {columnTasks.length}
                </span>
              </div>

              {/* Column controls (reveal on hover) */}
              <div className="flex items-center gap-1 mb-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => moveColumn(idx, -1)}
                  disabled={idx === 0}
                  className="hover:text-brand-600 disabled:opacity-30 disabled:hover:text-gray-300 transition-colors"
                  title="Move left"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => moveColumn(idx, 1)}
                  disabled={idx === columns.length - 1}
                  className="hover:text-brand-600 disabled:opacity-30 disabled:hover:text-gray-300 transition-colors"
                  title="Move right"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => startRename(column)}
                  className="hover:text-brand-600 transition-colors"
                  title="Rename column"
                >
                  <Edit2 size={14} />
                </button>
                {!column.builtin && (
                  <button
                    onClick={() => deleteColumn(column)}
                    className="hover:text-red-500 transition-colors"
                    title="Delete column"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {columnTasks.map(task => {
                  const project = projects.find(p => p.id === task.projectId);
                  const client = clients.find(c => c.id === project?.clientId);
                  const assignee = teamMembers.find(m => m.id === task.assignedTo);
                  const isOverdue = isTaskOverdue(task);

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      className={`kanban-card bg-gray-50 rounded-lg p-4 border border-gray-200 ${
                        draggedTask?.id === task.id ? 'dragging' : ''
                      } ${isOverdue ? 'border-red-300 bg-red-50' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 flex-1">{task.title}</h4>
                        <button
                          onClick={() => onEditTask(task)}
                          className="text-gray-400 hover:text-brand-600 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>

                      {task.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                      )}

                      <div className="space-y-2 text-xs">
                        {client && (
                          <div className="flex items-center text-gray-600">
                            <Users size={12} className="mr-1" />
                            {client.name}
                          </div>
                        )}
                        {assignee && (
                          <div className="flex items-center text-gray-600">
                            <User size={12} className="mr-1" />
                            {assignee.name}
                          </div>
                        )}
                        {task.dueDate && (
                          <div className={`flex items-center ${isOverdue ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>
                            <Calendar size={12} className="mr-1" />
                            {task.dueDate}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-400 italic">
                    No tasks yet
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add column tile */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-4">
            <label className="block text-sm font-medium text-gray-600 mb-2">Add column</label>
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColumn(); } }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mb-2"
              placeholder="Column name"
            />
            <button
              onClick={addColumn}
              className="w-full flex items-center justify-center gap-1 bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <Plus size={16} />Add column
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-brand-50 border border-brand-200 rounded-lg p-4">
        <p className="text-sm text-brand-800">
          <strong>💡 Tip:</strong> Drag tasks between columns to change their status. Add your own columns to fit your workflow.
        </p>
      </div>
    </div>
  );
}

// Gantt View Component - Modernized
function GanttView({ projects, tasks, clients, onEditProject, onEditTask }) {
  const getDateRange = () => {
    const allDates = [];
    
    projects.forEach(p => {
      if (p.startDate) allDates.push(parseLocalDate(p.startDate));
      if (p.endDate) allDates.push(parseLocalDate(p.endDate));
    });

    tasks.forEach(t => {
      if (t.startDate) allDates.push(parseLocalDate(t.startDate));
      if (t.dueDate) allDates.push(parseLocalDate(t.dueDate));
    });

    if (allDates.length === 0) {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setMonth(today.getMonth() + 3);
      return { min: today, max: futureDate };
    }

    return {
      min: new Date(Math.min(...allDates)),
      max: new Date(Math.max(...allDates))
    };
  };

  const { min: minDate, max: maxDate } = getDateRange();
  const daysDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) || 90;
  
  // Generate month markers
  const generateMonthMarkers = () => {
    const markers = [];
    const current = new Date(minDate);
    
    while (current <= maxDate) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      
      const startDays = Math.max(0, Math.ceil((monthStart - minDate) / (1000 * 60 * 60 * 24)));
      const endDays = Math.min(daysDiff, Math.ceil((monthEnd - minDate) / (1000 * 60 * 60 * 24)));
      const duration = endDays - startDays;
      
      if (duration > 0) {
        markers.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          left: `${(startDays / daysDiff) * 100}%`,
          width: `${(duration / daysDiff) * 100}%`
        });
      }
      
      current.setMonth(current.getMonth() + 1);
    }
    
    return markers;
  };
  
  const getBarPosition = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const startDays = Math.ceil((start - minDate) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) || 1;
    
    return {
      left: `${(startDays / daysDiff) * 100}%`,
      width: `${(duration / daysDiff) * 100}%`
    };
  };

  // Calculate progress for project based on tasks
  const getProjectProgress = (projectId) => {
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    const completed = projectTasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / projectTasks.length) * 100);
  };

  // Get today marker position
  const getTodayPosition = () => {
    const today = new Date();
    const todayDays = Math.ceil((today - minDate) / (1000 * 60 * 60 * 24));
    if (todayDays < 0 || todayDays > daysDiff) return null;
    return `${(todayDays / daysDiff) * 100}%`;
  };

  const monthMarkers = generateMonthMarkers();
  const todayPosition = getTodayPosition();

  // Build timeline groups: every project that has its own dates OR any dated task,
  // plus a "No Project" group for standalone dated tasks.
  const datedTasks = tasks.filter(t => t.dueDate || t.startDate);
  const projectIdSet = new Set(projects.map(p => p.id));
  const ganttGroups = [];
  projects.forEach(project => {
    const groupTasks = datedTasks.filter(t => t.projectId === project.id);
    const hasDates = !!(project.startDate && project.endDate);
    if (hasDates || groupTasks.length > 0) {
      ganttGroups.push({ key: project.id, project, hasDates, tasks: groupTasks });
    }
  });
  const orphanTasks = datedTasks.filter(t => !t.projectId || !projectIdSet.has(t.projectId));
  if (orphanTasks.length > 0) {
    ganttGroups.push({ key: '__no_project__', project: null, hasDates: false, tasks: orphanTasks });
  }

  // Status colors
  const statusColors = {
    'planning': 'bg-amber-500',
    'active': 'bg-green-500',
    'on-hold': 'bg-yellow-500',
    'completed': 'bg-gray-400'
  };

  if (ganttGroups.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
        <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No timeline data yet</h3>
        <p className="text-gray-600 mb-4">
          Add start/end dates to your projects, or start/due dates to your tasks, to visualize them on the Gantt chart.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Gantt Chart</h2>
        <p className="text-gray-600">Visual timeline of all projects and tasks</p>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-4 bg-gradient-to-r from-brand-500 to-brand-600 rounded"></div>
            <span className="text-gray-700">Project</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-3 bg-brand-300 rounded"></div>
            <span className="text-gray-700">Task</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-4 bg-gradient-to-r from-amber-500 to-amber-600 rounded"></div>
            <span className="text-gray-700">Planning</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-4 bg-gradient-to-r from-green-500 to-green-600 rounded"></div>
            <span className="text-gray-700">Active</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-4 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded"></div>
            <span className="text-gray-700">On Hold</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-6 bg-red-500 rounded"></div>
            <span className="text-gray-700">Today</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Timeline Header with Months */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 p-4">
          <div className="flex items-center">
            <div className="w-72 font-bold text-gray-900 text-sm">Project / Task</div>
            <div className="flex-1 pl-4">
              <div className="relative h-12 border border-gray-300 rounded bg-white">
                {monthMarkers.map((marker, idx) => (
                  <div
                    key={idx}
                    className="absolute top-0 h-full border-r border-gray-200 flex items-center justify-center"
                    style={{ left: marker.left, width: marker.width }}
                  >
                    <span className="text-xs font-semibold text-gray-700">{marker.month}</span>
                  </div>
                ))}
                {/* Today marker */}
                {todayPosition && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{ left: todayPosition }}
                  >
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Project & Task Bars */}
        <div className="p-4">
          <div className="space-y-4">
            {ganttGroups.map(group => {
              const project = group.project;
              const client = project ? clients.find(c => c.id === project.clientId) : null;
              const projectTasks = group.tasks;
              const position = project && group.hasDates ? getBarPosition(project.startDate, project.endDate) : null;
              const progress = project ? getProjectProgress(project.id) : 0;
              const statusColor = project ? (statusColors[project.status] || 'bg-brand-500') : 'bg-brand-500';
              const totalTasks = project ? tasks.filter(t => t.projectId === project.id).length : projectTasks.length;

              return (
                <div key={group.key} className={`border-l-4 ${project ? 'border-brand-500' : 'border-gray-300'} pl-4 bg-gray-50 rounded-r-lg py-3`}>
                  {/* Header Row */}
                  <div className="flex items-center mb-3">
                    <div className="w-64">
                      {project ? (
                        <>
                          <div className="flex items-center space-x-2 mb-1">
                            <FolderKanban size={18} className="text-brand-600" />
                            <button
                              onClick={() => onEditProject(project)}
                              className="font-bold text-gray-900 hover:text-brand-600 transition-colors text-left"
                            >
                              {project.name}
                            </button>
                          </div>
                          {client && (
                            <div className="text-xs text-gray-600 ml-7">{client.name}</div>
                          )}
                          <div className="text-xs text-gray-500 ml-7 mt-1">
                            {group.hasDates && `${progress}% complete • `}{totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}
                            {!group.hasDates && <span className="ml-1 italic text-gray-400">(no project dates)</span>}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Calendar size={18} className="text-gray-400" />
                          <span className="font-bold text-gray-700">No Project</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 pl-4 relative h-12">
                      {position && (
                        <div className="relative">
                          {/* Project bar with gradient */}
                          <div
                            className={`absolute top-2 h-8 bg-gradient-to-r ${statusColor.replace('bg-', 'from-')} ${statusColor.replace('bg-', 'to-').replace('500', '600')} rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer overflow-hidden`}
                            style={position}
                            onClick={() => onEditProject(project)}
                          >
                            {/* Progress bar inside */}
                            <div
                              className="absolute top-0 left-0 h-full bg-white bg-opacity-30"
                              style={{ width: `${progress}%` }}
                            ></div>
                            {/* Project name and progress */}
                            <div className="relative h-full flex items-center justify-between px-3 text-white text-xs font-semibold">
                              <span className="truncate">{project.name}</span>
                              <span className="ml-2 opacity-90">{progress}%</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task Rows */}
                  {projectTasks.length > 0 && (
                    <div className="space-y-2 ml-4">
                      {projectTasks.map(task => {
                        let barStart = task.startDate;
                        if (!barStart && task.dueDate) {
                          const d = parseLocalDate(task.dueDate);
                          d.setDate(d.getDate() - 3); // fallback: 3-day bar for tasks with only a due date
                          barStart = toYMD(d);
                        }
                        const barEnd = task.dueDate || task.startDate;
                        const taskPosition = getBarPosition(barStart, barEnd);
                        const isCompleted = task.status === 'completed';
                        const refDate = task.dueDate || task.startDate;
                        const isOverdue = refDate && parseLocalDate(refDate) < startOfToday() && !isCompleted;

                        return (
                          <div key={task.id} className="flex items-center">
                            <div className="w-60">
                              <div className="flex items-center space-x-2">
                                <CheckSquare size={14} className={isCompleted ? 'text-green-600' : 'text-gray-400'} />
                                <button
                                  onClick={() => onEditTask(task)}
                                  className="text-sm text-gray-700 hover:text-brand-600 transition-colors text-left truncate"
                                >
                                  {task.title}
                                </button>
                              </div>
                            </div>

                            <div className="flex-1 pl-4 relative h-7">
                              {taskPosition && (
                                <div
                                  className={`absolute top-1.5 h-4 rounded shadow hover:shadow-md transition-all cursor-pointer ${
                                    isCompleted
                                      ? 'bg-green-400'
                                      : isOverdue
                                      ? 'bg-red-400'
                                      : 'bg-brand-300'
                                  }`}
                                  style={taskPosition}
                                  onClick={() => onEditTask(task)}
                                  title={`${task.title}${task.startDate ? ' — Start: ' + task.startDate : ''}${task.dueDate ? ' → Due: ' + task.dueDate : ''}`}
                                >
                                  {isCompleted && (
                                    <div className="h-full flex items-center justify-center text-white">
                                      <CheckCircle size={10} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-brand-50 border border-brand-200 rounded-lg p-4">
        <p className="text-sm text-brand-800">
          <strong>💡 Tip:</strong> Project bars show progress based on task completion. The red line marks today's date. Click any bar to edit!
        </p>
      </div>
    </div>
  );
}

// Dashboard View Component (Enhanced with navigation)
function DashboardView({ clients, projects, tasks, teamMembers, onNavigate }) {
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const upcomingTasks = activeTasks.filter(t => {
    if (!t.dueDate) return false;
    const dueDate = parseLocalDate(t.dueDate);
    const today = startOfToday();
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return dueDate >= today && dueDate <= sevenDaysFromNow;
  });
  const overdueTasks = activeTasks.filter(t => isTaskOverdue(t));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
        <p className="text-gray-600">Overview of your client success operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Active Clients"
          value={clients.length}
          icon={Users}
          color="blue"
          onClick={() => onNavigate('clients')}
        />
        <StatCard
          label="Active Projects"
          value={projects.filter(p => p.status !== 'completed').length}
          icon={FolderKanban}
          color="green"
          onClick={() => onNavigate('projects')}
        />
        <StatCard
          label="Open Tasks"
          value={activeTasks.length}
          icon={CheckSquare}
          color="purple"
          onClick={() => onNavigate('tasks')}
        />
        <StatCard
          label="Team Members"
          value={teamMembers.length}
          icon={User}
          color="purple"
          onClick={() => onNavigate('team')}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate('kanban')}
          className="bg-gradient-to-br from-brand-500 to-brand-600 text-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
        >
          <Trello size={32} className="mb-2" />
          <h3 className="text-lg font-bold">Kanban Board</h3>
          <p className="text-sm text-brand-100 mt-1">Drag & drop task management</p>
        </button>

        <button
          onClick={() => onNavigate('gantt')}
          className="bg-gradient-to-br from-brand-500 to-brand-600 text-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
        >
          <BarChart3 size={32} className="mb-2" />
          <h3 className="text-lg font-bold">Gantt Chart</h3>
          <p className="text-sm text-brand-100 mt-1">Timeline visualization</p>
        </button>

        <button
          onClick={() => onNavigate('table')}
          className="bg-gradient-to-br from-brand-500 to-brand-600 text-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
        >
          <CheckSquare size={32} className="mb-2" />
          <h3 className="text-lg font-bold">All Tasks</h3>
          <p className="text-sm text-brand-100 mt-1">Comprehensive task list</p>
        </button>
      </div>

      {/* Alerts */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <AlertCircle className="text-red-600 mt-0.5 mr-3" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Overdue Tasks</h3>
              <p className="text-red-700 text-sm mt-1">
                You have {overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''} that need attention.
              </p>
            </div>
            <button
              onClick={() => onNavigate('kanban')}
              className="text-red-600 hover:text-red-800 transition-colors"
            >
              <ExternalLink size={18} />
            </button>
          </div>
        </div>
      )}

      {upcomingTasks.length > 0 && (
        <div className="bg-brand-50 border-l-4 border-brand-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <Clock className="text-brand-600 mt-0.5 mr-3" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-brand-900">Upcoming Tasks</h3>
              <p className="text-brand-700 text-sm mt-1">
                {upcomingTasks.length} task{upcomingTasks.length !== 1 ? 's' : ''} due in the next 7 days.
              </p>
            </div>
            <button
              onClick={() => onNavigate('kanban')}
              className="text-brand-600 hover:text-brand-800 transition-colors"
            >
              <ExternalLink size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Recent Clients</h2>
            <button
              onClick={() => onNavigate('clients')}
              className="text-brand-600 hover:text-brand-700 transition-colors"
            >
              <ExternalLink size={18} />
            </button>
          </div>
          {clients.length === 0 ? (
            <p className="text-gray-500 italic">No clients yet. Add your first client to get started!</p>
          ) : (
            <div className="space-y-3">
              {clients.slice(0, 5).map(client => (
                <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div>
                    <div className="font-semibold text-gray-900">{client.name}</div>
                    <div className="text-sm text-gray-600">{client.company}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {projects.filter(p => p.clientId === client.id).length} projects
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Active Projects</h2>
            <button
              onClick={() => onNavigate('projects')}
              className="text-brand-600 hover:text-brand-700 transition-colors"
            >
              <ExternalLink size={18} />
            </button>
          </div>
          {projects.length === 0 ? (
            <p className="text-gray-500 italic">No projects yet. Create your first project!</p>
          ) : (
            <div className="space-y-3">
              {projects.filter(p => p.status !== 'completed').slice(0, 5).map(project => {
                const client = clients.find(c => c.id === project.clientId);
                return (
                  <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <div>
                      <div className="font-semibold text-gray-900">{project.name}</div>
                      <div className="text-sm text-gray-600">{client?.name || 'No client'}</div>
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

// My Tasks View Component (Today-style personal agenda)
function MyTasksView({ tasks, projects, clients, teamMembers, onAdd, onEdit, onDelete, onUpdateStatus }) {
  // Persisted "Viewing as" identity so the agenda feels personal without auth
  const [meId, setMeId] = useState(() => localStorage.getItem('my-tasks-user') || 'all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  useEffect(() => {
    localStorage.setItem('my-tasks-user', meId);
  }, [meId]);

  // Fall back to "Everyone" if the saved team member no longer exists
  const effectiveMeId = (meId !== 'all' && !teamMembers.some(m => m.id === meId)) ? 'all' : meId;

  const projectPalette = ['bg-brand-500', 'bg-green-500', 'bg-amber-500', 'bg-orange-500', 'bg-teal-500', 'bg-gray-500'];
  const projectColor = (projectId) => {
    const idx = projects.findIndex(p => p.id === projectId);
    return projectPalette[(idx < 0 ? 0 : idx) % projectPalette.length];
  };
  const projectFor = (t) => projects.find(p => p.id === t.projectId) || null;
  const clientFor = (t) => { const p = projectFor(t); return p ? (clients.find(c => c.id === p.clientId) || null) : null; };
  const parseDue = (t) => parseLocalDate(t.dueDate);
  const dateKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const dueLabel = (t) => {
    const d = parseDue(t);
    if (!d) return null;
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === -1) return 'Yesterday';
    if (diff === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {})
    });
  };

  // Filter to the selected person ("me")
  const mine = tasks.filter(t => effectiveMeId === 'all' || t.assignedTo === effectiveMeId);
  const active = mine.filter(t => t.status !== 'completed');
  const completed = mine.filter(t => t.status === 'completed');

  // Bucket active tasks by due date, then order each bucket by date and priority
  const byDatePriority = (a, b) => {
    const da = parseDue(a)?.getTime() ?? Infinity;
    const db = parseDue(b)?.getTime() ?? Infinity;
    if (da !== db) return da - db;
    return priorityRank(a.priority) - priorityRank(b.priority);
  };
  const overdue = [], todayTasks = [], upcoming = [], noDate = [];
  active.forEach(t => {
    const d = parseDue(t);
    if (!d) noDate.push(t);
    else if (d < today) overdue.push(t);
    else if (d.getTime() === today.getTime()) todayTasks.push(t);
    else upcoming.push(t);
  });
  [overdue, todayTasks, upcoming, noDate].forEach(list => list.sort(byDatePriority));

  // Days that have pending tasks (for calendar dots)
  const dueDayKeys = new Set();
  active.forEach(t => { const d = parseDue(t); if (d) dueDayKeys.add(dateKey(d)); });

  const meName = effectiveMeId === 'all' ? null : (teamMembers.find(m => m.id === effectiveMeId)?.name || null);
  const headerDate = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const toggleComplete = (task) => {
    onUpdateStatus(task.id, { ...task, status: task.status === 'completed' ? 'todo' : 'completed' });
  };

  const renderTask = (task) => {
    const project = projectFor(task);
    const client = clientFor(task);
    const d = parseDue(task);
    const isOverdue = d && d < today && task.status !== 'completed';
    const isDone = task.status === 'completed';
    const st = task.subtasks || [];
    const stDone = st.filter(s => s.done).length;
    return (
      <div
        key={task.id}
        onClick={() => onEdit(task)}
        className="group flex items-start gap-3 px-4 py-3 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <button
          onClick={(e) => { e.stopPropagation(); toggleComplete(task); }}
          className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform"
          title={isDone ? 'Mark as not done' : 'Mark complete'}
        >
          {isDone
            ? <CheckCircle size={22} className="text-green-600" />
            : <Circle size={22} className={isOverdue ? 'text-red-400 hover:text-red-600' : 'text-gray-300 hover:text-brand-600'} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-base font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm">
            {!isDone && <PriorityBadge priority={task.priority} />}
            {task.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                <Calendar size={14} />{dueLabel(task)}
              </span>
            )}
            {st.length > 0 && (
              <span className="flex items-center gap-1 text-gray-500"><CheckSquare size={14} />{stDone}/{st.length}</span>
            )}
            {project && (
              <span className="flex items-center gap-1.5 text-gray-500">
                <span className={`w-2 h-2 rounded-full ${projectColor(project.id)}`}></span>{project.name}
              </span>
            )}
            {client && (
              <span className="flex items-center gap-1 text-gray-500"><Users size={14} />{client.name}</span>
            )}
            {task.phaseName && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 font-medium">{task.phaseName}</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all flex-shrink-0 mt-1"
          title="Delete task"
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  const renderSection = (label, items, accent = 'text-gray-500') => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 px-4 mb-1">
          <h3 className={`text-xs font-bold uppercase tracking-wider ${accent}`}>{label}</h3>
          <span className="text-xs text-gray-400">· {items.length}</span>
        </div>
        <div className="h-px bg-gray-200 mb-1 mx-4"></div>
        <div>{items.map(renderTask)}</div>
      </div>
    );
  };

  // Tasks for a clicked calendar day
  const selectedDayTasks = selectedDate
    ? mine.filter(t => { const d = parseDue(t); return d && dateKey(d) === dateKey(selectedDate); })
        .sort((a, b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0))
    : [];

  // Build the 6-week calendar grid (Monday-first)
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const leadWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(viewYear, viewMonth, 1 - leadWeekday);
  const calendarCells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const monthLabel = firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const prevMonth = () => {
    const m = viewMonth - 1;
    if (m < 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(m);
  };
  const nextMonth = () => {
    const m = viewMonth + 1;
    if (m > 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(m);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Sun size={28} className="text-brand-600" /> Today
          </h2>
          <p className="text-gray-500 mt-1">
            {headerDate} · {active.length} {active.length === 1 ? 'task' : 'tasks'}
            {meName ? ` · ${meName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={effectiveMeId}
            onChange={(e) => setMeId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            title="Viewing as"
          >
            <option value="all">Everyone</option>
            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg whitespace-nowrap"
          >
            <Plus size={20} /><span>Add Task</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda */}
        <div className="lg:col-span-2">
          {/* Quick add */}
          <button
            onClick={onAdd}
            className="w-full flex items-center gap-2 px-4 py-3 mb-6 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <Plus size={20} /><span className="font-medium">Add task</span>
          </button>

          {selectedDate ? (
            <div>
              <div className="flex items-center justify-between px-4 mb-3">
                <h3 className="text-sm font-bold text-gray-700">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <button onClick={() => setSelectedDate(null)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                  ← Back to today
                </button>
              </div>
              {selectedDayTasks.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-10 text-center shadow-sm">
                  <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No tasks due on this day.</p>
                </div>
              ) : (
                <div>{selectedDayTasks.map(renderTask)}</div>
              )}
            </div>
          ) : active.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">You're all caught up</h3>
              <p className="text-gray-600 mb-4">No open tasks{meName ? ` for ${meName}` : ''}. Add one to get started.</p>
              <button onClick={onAdd} className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg transition-colors">
                Add a Task
              </button>
            </div>
          ) : (
            <div>
              {renderSection('Overdue', overdue, 'text-red-500')}
              {renderSection('Today', todayTasks, 'text-brand-600')}
              {renderSection('Upcoming', upcoming)}
              {renderSection('No due date', noDate)}
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showCompleted ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="font-medium">Completed · {completed.length}</span>
              </button>
              {showCompleted && <div>{completed.map(renderTask)}</div>}
            </div>
          )}
        </div>

        {/* Mini calendar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:sticky lg:top-[100px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">{monthLabel}</h3>
              <div className="flex items-center gap-1">
                <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500" title="Previous month">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500" title="Next month">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((d, i) => {
                const inMonth = d.getMonth() === viewMonth;
                const isToday = d.getTime() === today.getTime();
                const isSelected = selectedDate && dateKey(d) === dateKey(selectedDate);
                const hasDue = dueDayKeys.has(dateKey(d));
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(isSelected ? null : new Date(d))}
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors
                      ${isToday ? 'bg-brand-600 text-white font-bold' : isSelected ? 'bg-brand-100 text-brand-700 font-semibold ring-2 ring-brand-400' : inMonth ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-50'}`}
                  >
                    <span>{d.getDate()}</span>
                    {hasDue && (
                      <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isToday ? 'bg-white' : 'bg-brand-500'}`}></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Today at a glance */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} className="text-gray-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">At a glance</h4>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Overdue</span><span className="font-semibold text-red-500">{overdue.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Due today</span><span className="font-semibold text-brand-600">{todayTasks.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Upcoming</span><span className="font-semibold text-gray-700">{upcoming.length}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Team Calendar — availability (who's out) + client events, on a month grid
function CalendarEventsView({ calendarEvents, teamMembers, clients, onAdd, onEdit, onDelete }) {
  const today = startOfToday();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterCat, setFilterCat] = useState('all');

  const memberName = (id) => teamMembers.find(m => m.id === id)?.name || '';

  const fmtTime = (t) => {
    if (!t) return '';
    const [hs, ms] = t.split(':');
    let h = parseInt(hs, 10); const m = ms;
    const ap = h >= 12 ? 'p' : 'a';
    h = h % 12; if (h === 0) h = 12;
    return m === '00' ? `${h}${ap}` : `${h}:${m}${ap}`;
  };

  const passesFilter = (ev) => {
    const meta = eventTypeMeta(ev.eventType);
    if (filterCat !== 'all' && meta.cat !== filterCat) return false;
    if (filterPerson !== 'all' && ev.memberId && ev.memberId !== filterPerson) return false;
    return true;
  };
  const events = calendarEvents.filter(passesFilter);

  const coversDay = (ev, d) => {
    const s = parseLocalDate(ev.startDate); if (!s) return false;
    const e = ev.endDate ? parseLocalDate(ev.endDate) : s;
    return d >= s && d <= e;
  };
  const eventsForDay = (d) => events.filter(ev => coversDay(ev, d))
    .sort((a, b) => (a.allDay === b.allDay ? (a.startTime || '').localeCompare(b.startTime || '') : (a.allDay ? -1 : 1)));

  const chipText = (ev) => {
    const meta = eventTypeMeta(ev.eventType);
    const who = ev.memberId ? memberName(ev.memberId) : '';
    const primary = meta.cat === 'avail' ? (who || meta.label) : (ev.title || meta.label);
    const time = (!ev.allDay && ev.startTime) ? fmtTime(ev.startTime) + ' ' : '';
    return time + primary;
  };

  // "Out this week" — availability events overlapping the current (real) week, Monday-first
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const overlaps = (ev, rs, re) => {
    const s = parseLocalDate(ev.startDate); if (!s) return false;
    const e = ev.endDate ? parseLocalDate(ev.endDate) : s;
    return s <= re && e >= rs;
  };
  const outThisWeek = events
    .filter(ev => eventTypeMeta(ev.eventType).cat === 'avail' && overlaps(ev, weekStart, weekEnd))
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  const rangeLabel = (ev) => {
    const s = parseLocalDate(ev.startDate); const e = ev.endDate ? parseLocalDate(ev.endDate) : s;
    const opt = { month: 'short', day: 'numeric' };
    if (!e || s.getTime() === e.getTime()) return s.toLocaleDateString('en-US', opt);
    return `${s.toLocaleDateString('en-US', opt)} – ${e.toLocaleDateString('en-US', opt)}`;
  };

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const leadWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(viewYear, viewMonth, 1 - leadWeekday);
  const calendarCells = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); d.setHours(0, 0, 0, 0); return d; });
  const monthLabel = firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const prevMonth = () => { const m = viewMonth - 1; if (m < 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(m); };
  const nextMonth = () => { const m = viewMonth + 1; if (m > 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(m); };
  const goToday = () => { setViewMonth(today.getMonth()); setViewYear(today.getFullYear()); };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={28} className="text-brand-600" /> Calendar
          </h2>
          <p className="text-gray-500 mt-1">Team availability &amp; client events</p>
        </div>
        <button onClick={onAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg whitespace-nowrap self-start">
          <Plus size={20} /><span>Add Event</span>
        </button>
      </div>

      {/* Out this week */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <User size={16} className="text-gray-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Out this week</h3>
        </div>
        {outThisWeek.length === 0 ? (
          <p className="text-sm text-gray-400">Everyone's available this week.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {outThisWeek.map(ev => {
              const meta = eventTypeMeta(ev.eventType);
              return (
                <button key={ev.id} onClick={() => onEdit(ev)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.chip}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>
                  {(ev.memberId ? memberName(ev.memberId) : ev.title) || meta.label} · {meta.label} · {rangeLabel(ev)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Previous month"><ChevronLeft size={18} /></button>
          <h3 className="text-lg font-bold text-gray-900 w-36 sm:w-44 text-center">{monthLabel}</h3>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Next month"><ChevronRight size={18} /></button>
          <button onClick={goToday} className="ml-1 text-sm text-brand-600 hover:text-brand-700 font-medium">Today</button>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)} className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="all">Everyone</option>
            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="all">All types</option>
            <option value="avail">Availability</option>
            <option value="client">Client events</option>
          </select>
        </div>
      </div>

      {/* Month grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((d, i) => {
            const inMonth = d.getMonth() === viewMonth;
            const isToday = d.getTime() === today.getTime();
            const dayEvents = eventsForDay(d);
            const shown = dayEvents.slice(0, 3);
            const extra = dayEvents.length - shown.length;
            return (
              <div key={i} className={`min-h-[64px] sm:min-h-[96px] rounded-lg border p-1 flex flex-col gap-0.5 ${inMonth ? 'bg-white border-gray-100' : 'bg-gray-50 border-transparent'}`}>
                <div className={`text-[10px] sm:text-xs font-semibold px-1 ${isToday ? 'text-white bg-brand-600 rounded-full w-5 h-5 flex items-center justify-center' : inMonth ? 'text-gray-600' : 'text-gray-300'}`}>{d.getDate()}</div>
                {shown.map(ev => {
                  const meta = eventTypeMeta(ev.eventType);
                  return (
                    <button key={ev.id} onClick={() => onEdit(ev)} title={chipText(ev)} className={`text-left truncate rounded px-1 py-0.5 text-[10px] leading-tight font-medium ${meta.chip}`}>
                      {chipText(ev)}
                    </button>
                  );
                })}
                {extra > 0 && <span className="text-[10px] text-gray-400 px-1">+{extra} more</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 px-1">
        {EVENT_TYPE_ORDER.map(t => {
          const meta = EVENT_TYPES[t];
          return (
            <span key={t} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`}></span>{meta.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Clients View Component (Enhanced with navigation)
function ClientsView({ clients, onAdd, onEdit, onDelete, onView, projects, tasks, teamMembers, onNavigate }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Clients</h2>
        <button
          onClick={onAdd}
          className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus size={20} />
          <span>Add Client</span>
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No clients yet</h3>
          <p className="text-gray-600 mb-4">Start by adding your first client to track their projects and tasks.</p>
          <button
            onClick={onAdd}
            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg transition-colors"
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
            const assignedMember = teamMembers.find(m => m.id === client.assignedTo);
            
            return (
              <div key={client.id} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm task-card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{client.name}</h3>
                    <p className="text-gray-600">{client.company}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(client)}
                      className="text-gray-600 hover:text-brand-600 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => onDelete(client.id)}
                      className="text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  {client.email && (
                    <p className="text-sm text-gray-600">✉️ {client.email}</p>
                  )}
                  {client.phone && (
                    <p className="text-sm text-gray-600">📞 {client.phone}</p>
                  )}
                  {assignedMember && (
                    <p className="text-sm text-gray-600">👤 {assignedMember.name}</p>
                  )}
                  {client.populationSize && (
                    <p className="text-sm text-gray-600">👥 Population: {client.populationSize}</p>
                  )}
                  {client.yearEndDate && (
                    <p className="text-sm text-gray-600">📅 Year-End: {client.yearEndDate}</p>
                  )}
                </div>
                
                <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-gray-600">{clientProjects.length} projects</span>
                    <span className="text-gray-600">{clientTasks.length} tasks</span>
                  </div>
                  <button
                    onClick={() => onView(client)}
                    className="w-full text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    View Details
                  </button>
                  {clientProjects.length > 0 && (
                    <button
                      onClick={() => onNavigate('projects')}
                      className="w-full text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center justify-center space-x-1"
                    >
                      <span>View Projects</span>
                      <ExternalLink size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Projects View Component (Enhanced with navigation)
function ProjectsView({ projects, clients, tasks, onAdd, onEdit, onDelete, onNavigate }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Projects</h2>
        <button
          onClick={onAdd}
          className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus size={20} />
          <span>Add Project</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FolderKanban size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-600 mb-4">Create your first project to start managing tasks.</p>
          <button
            onClick={onAdd}
            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg transition-colors"
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
              <div key={project.id} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm task-card">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{project.name}</h3>
                      <StatusBadge status={project.status} />
                    </div>
                    {client && (
                      <button
                        onClick={() => onNavigate('clients')}
                        className="text-gray-600 hover:text-brand-600 transition-colors mb-2 text-sm flex items-center space-x-1"
                      >
                        <Users size={14} />
                        <span>Client: {client.name}</span>
                        <ExternalLink size={12} />
                      </button>
                    )}
                    {project.description && (
                      <p className="text-gray-600 mb-4">{project.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-6 text-sm">
                      <button
                        onClick={() => onNavigate('tasks')}
                        className="text-gray-600 hover:text-brand-600 transition-colors flex items-center space-x-1"
                      >
                        <CheckSquare size={14} />
                        <span>Tasks: {completedTasks.length}/{projectTasks.length} completed</span>
                      </button>
                      {project.startDate && (
                        <span className="text-gray-600">Start: {project.startDate}</span>
                      )}
                      {project.endDate && (
                        <span className="text-gray-600">End: {project.endDate}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => onEdit(project)}
                      className="text-gray-600 hover:text-brand-600 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => onDelete(project.id)}
                      className="text-gray-600 hover:text-red-600 transition-colors"
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

// Tasks View Component - Grouped by Client
function TasksView({ tasks, projects, clients, teamMembers, onAdd, onEdit, onDelete, onUpdateStatus }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedClients, setExpandedClients] = useState({});
  
  const filteredTasks = filterStatus === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === filterStatus);

  // Group tasks by client
  const tasksByClient = {};
  
  filteredTasks.forEach(task => {
    const project = projects.find(p => p.id === task.projectId);
    const clientId = project?.clientId || 'no-client';
    
    if (!tasksByClient[clientId]) {
      tasksByClient[clientId] = [];
    }
    tasksByClient[clientId].push(task);
  });

  // Get client objects for sorting
  const clientGroups = Object.keys(tasksByClient).map(clientId => {
    if (clientId === 'no-client') {
      return {
        id: 'no-client',
        name: 'No Client Assigned',
        tasks: tasksByClient[clientId]
      };
    }
    const client = clients.find(c => c.id === clientId);
    return {
      id: clientId,
      name: client?.name || 'Unknown Client',
      client: client,
      tasks: tasksByClient[clientId]
    };
  }).sort((a, b) => {
    if (a.id === 'no-client') return 1;
    if (b.id === 'no-client') return -1;
    return a.name.localeCompare(b.name);
  });

  const toggleClient = (clientId) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  // Expand all by default
  useEffect(() => {
    const allExpanded = {};
    clientGroups.forEach(group => {
      allExpanded[group.id] = true;
    });
    setExpandedClients(allExpanded);
  }, [tasks.length, filterStatus]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Tasks by Client</h2>
          <p className="text-gray-600">Organized by client for easy management</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All Tasks</option>
          {loadBoardColumns().map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <button
          onClick={onAdd}
          className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus size={20} />
          <span>Add Task</span>
        </button>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
          <CheckSquare size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {filterStatus === 'all' ? 'No tasks yet' : `No ${filterStatus.replace('-', ' ')} tasks`}
          </h3>
          <p className="text-gray-600 mb-4">Create your first task to get started.</p>
          <button
            onClick={onAdd}
            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Create Your First Task
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {clientGroups.map(group => {
            const isExpanded = expandedClients[group.id];
            const completedCount = group.tasks.filter(t => t.status === 'completed').length;
            
            return (
              <div key={group.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Client Header */}
                <button
                  onClick={() => toggleClient(group.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    {isExpanded ? <ChevronDown size={20} className="text-gray-600" /> : <ChevronRight size={20} className="text-gray-600" />}
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${group.id === 'no-client' ? 'bg-gray-400' : 'bg-brand-500'}`}></div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-gray-900">{group.name}</h3>
                        {group.client && group.client.company && (
                          <p className="text-sm text-gray-600">{group.client.company}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      {completedCount}/{group.tasks.length} completed
                    </span>
                    <span className="px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-sm font-semibold">
                      {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                </button>

                {/* Tasks List */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    <div className="p-4 space-y-3">
                      {group.tasks.map(task => {
                        const project = projects.find(p => p.id === task.projectId);
                        const assignee = teamMembers.find(m => m.id === task.assignedTo);
                        const isOverdue = isTaskOverdue(task);
                        
                        return (
                          <div 
                            key={task.id} 
                            className={`bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition-all ${
                              isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center flex-wrap gap-3 mb-2">
                                  <h4 className="text-lg font-bold text-gray-900">{task.title}</h4>
                                  <StatusBadge status={task.status} />
                                  <PriorityBadge priority={task.priority} />
                                  {isOverdue && (
                                    <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full font-medium">
                                      OVERDUE
                                    </span>
                                  )}
                                </div>
                                
                                {task.description && (
                                  <p className="text-gray-600 mb-3 text-sm">{task.description}</p>
                                )}
                                
                                <div className="flex flex-wrap items-center gap-3 text-sm">
                                  {project && (
                                    <span className="text-gray-600 flex items-center space-x-1">
                                      <FolderKanban size={14} />
                                      <span>{project.name}</span>
                                    </span>
                                  )}
                                  {assignee && (
                                    <span className="text-gray-600 flex items-center space-x-1">
                                      <User size={14} />
                                      <span>{assignee.name}</span>
                                    </span>
                                  )}
                                  {task.dueDate && (
                                    <span className={`flex items-center space-x-1 ${isOverdue ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>
                                      <Calendar size={14} />
                                      <span>{task.dueDate}</span>
                                    </span>
                                  )}
                                  {task.phase && (
                                    <span className="px-2 py-1 bg-brand-100 text-brand-700 text-xs rounded-full font-medium">
                                      {task.phaseName}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="mt-3 flex space-x-2">
                                  <button
                                    onClick={() => onUpdateStatus(task.id, { ...task, status: 'todo' })}
                                    className={`px-3 py-1 rounded text-xs transition-colors ${
                                      task.status === 'todo'
                                        ? 'bg-gray-700 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                  >
                                    To Do
                                  </button>
                                  <button
                                    onClick={() => onUpdateStatus(task.id, { ...task, status: 'in-progress' })}
                                    className={`px-3 py-1 rounded text-xs transition-colors ${
                                      task.status === 'in-progress'
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                                    }`}
                                  >
                                    In Progress
                                  </button>
                                  <button
                                    onClick={() => onUpdateStatus(task.id, { ...task, status: 'completed' })}
                                    className={`px-3 py-1 rounded text-xs transition-colors ${
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
                                  className="text-gray-600 hover:text-brand-600 transition-colors"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => onDelete(task.id)}
                                  className="text-gray-600 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Resources View Component - Links Only
function ResourcesView({ resources, onAddLink, onEditLink, onDeleteLink }) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState(null);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Resources</h2>
        <p className="text-gray-600">Helpful links and resources for your team</p>
      </div>

      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <Link size={24} className="text-brand-600" />
          <h3 className="text-xl font-semibold text-gray-900">
            Team Resources ({resources.links?.length || 0})
          </h3>
        </div>
        <button
          onClick={() => { setEditingLink(null); setShowLinkModal(true); }}
          className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus size={20} />
          <span>Add Link</span>
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-brand-800">
          <strong>💡 Tip:</strong> Share training materials, documentation, and helpful websites. 
          Link to Google Drive, Dropbox, or any external resource your team needs!
        </p>
      </div>

      {/* Links Grid */}
      {!resources.links || resources.links.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
          <Link size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No resources yet</h3>
          <p className="text-gray-600 mb-4">
            Add helpful links to training materials, documentation, and tools your team needs.
          </p>
          <button
            onClick={() => { setEditingLink(null); setShowLinkModal(true); }}
            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Add Your First Link
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.links.map(link => (
            <div
              key={link.id}
              className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all bg-white"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2 flex-1">
                  <ExternalLink size={20} className="text-brand-600 flex-shrink-0" />
                  <h4 className="font-bold text-gray-900 text-lg leading-tight">{link.title}</h4>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => { setEditingLink(link); setShowLinkModal(true); }}
                    className="p-1.5 text-gray-600 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onDeleteLink(link.id)}
                    className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {link.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-3">{link.description}</p>
              )}
              
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-brand-50 hover:bg-brand-100 text-brand-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors mb-3"
              >
                Visit Link →
              </a>
              
              <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                <span>Added {new Date(link.dateAdded).toLocaleDateString()}</span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:text-brand-700 truncate max-w-[150px]"
                  title={link.url}
                >
                  {link.url.replace(/^https?:\/\//, '').split('/')[0]}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <LinkModal
          link={editingLink}
          onSave={(link) => {
            if (editingLink) {
              onEditLink(editingLink.id, link);
            } else {
              onAddLink(link);
            }
            setShowLinkModal(false);
            setEditingLink(null);
          }}
          onClose={() => { setShowLinkModal(false); setEditingLink(null); }}
        />
      )}
    </div>
  );
}

// Link Modal Component
function LinkModal({ link, onSave, onClose }) {
  const [formData, setFormData] = useState(link || {
    title: '',
    url: '',
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.url.trim()) {
      alert('Please enter both title and URL');
      return;
    }
    
    // Basic URL validation
    try {
      new URL(formData.url);
    } catch {
      alert('Please enter a valid URL (include http:// or https://)');
      return;
    }
    
    onSave(formData);
  };

  return (
    <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {link ? 'Edit Link' : 'Add New Link'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g., PBB Training Portal"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL *
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="https://example.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Brief description of this resource..."
              rows="3"
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Save Link
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Table View Component - Wrike Style
function TableView({ tasks, projects, clients, teamMembers, onEditTask, onUpdateStatus }) {
  const [sortColumn, setSortColumn] = useState('dueDate');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterAssignee !== 'all' && task.assignedTo !== filterAssignee) return false;
    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortColumn) {
      case 'title':
        aVal = a.title.toLowerCase();
        bVal = b.title.toLowerCase();
        break;
      case 'project':
        const aProject = projects.find(p => p.id === a.projectId);
        const bProject = projects.find(p => p.id === b.projectId);
        aVal = aProject?.name.toLowerCase() || '';
        bVal = bProject?.name.toLowerCase() || '';
        break;
      case 'assignedTo':
        const aAssignee = teamMembers.find(m => m.id === a.assignedTo);
        const bAssignee = teamMembers.find(m => m.id === b.assignedTo);
        aVal = aAssignee?.name.toLowerCase() || 'zzz';
        bVal = bAssignee?.name.toLowerCase() || 'zzz';
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
      case 'priority':
        aVal = priorityRank(a.priority);
        bVal = priorityRank(b.priority);
        break;
      case 'dueDate':
        aVal = a.dueDate || '9999-12-31';
        bVal = b.dueDate || '9999-12-31';
        break;
      default:
        return 0;
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return <ChevronDown size={14} className="opacity-0 group-hover:opacity-30" />;
    return sortDirection === 'asc' ? <ChevronDown size={14} /> : <ChevronRight size={14} className="rotate-180" />;
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Table View</h2>
        <p className="text-gray-600">Comprehensive task list with sorting and filtering</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex items-center space-x-4">
          <Filter size={20} className="text-gray-600" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Status</option>
            {loadBoardColumns().map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Team Members</option>
            {teamMembers.map(member => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
          <span className="text-sm text-gray-600 ml-auto">
            Showing {sortedTasks.length} of {tasks.length} tasks
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="px-6 py-3 text-left cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-semibold text-gray-700 uppercase">Task</span>
                    <SortIcon column="title" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('project')}
                >
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-semibold text-gray-700 uppercase">Project</span>
                    <SortIcon column="project" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('assignedTo')}
                >
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-semibold text-gray-700 uppercase">Assigned To</span>
                    <SortIcon column="assignedTo" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-semibold text-gray-700 uppercase">Status</span>
                    <SortIcon column="status" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('priority')}
                >
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-semibold text-gray-700 uppercase">Priority</span>
                    <SortIcon column="priority" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left cursor-pointer group hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-semibold text-gray-700 uppercase">Due Date</span>
                    <SortIcon column="dueDate" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left">
                  <span className="text-xs font-semibold text-gray-700 uppercase">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedTasks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No tasks match your filters
                  </td>
                </tr>
              ) : (
                sortedTasks.map(task => {
                  const project = projects.find(p => p.id === task.projectId);
                  const client = clients.find(c => c.id === project?.clientId);
                  const assignee = teamMembers.find(m => m.id === task.assignedTo);
                  const isOverdue = isTaskOverdue(task);

                  return (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{task.title}</div>
                          {client && (
                            <div className="text-sm text-gray-600">{client.name}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{project?.name || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{assignee?.name || 'Unassigned'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-6 py-4">
                        {PRIORITIES[task.priority] ? <PriorityBadge priority={task.priority} /> : <span className="text-sm text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        {task.dueDate ? (
                          <div className={`text-sm ${isOverdue ? 'text-red-700 font-semibold' : 'text-gray-900'}`}>
                            {parseLocalDate(task.dueDate).toLocaleDateString()}
                            {isOverdue && <span className="ml-2 text-xs">(Overdue)</span>}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => onEditTask(task)}
                          className="text-brand-600 hover:text-brand-700 text-sm font-medium"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-brand-50 border border-brand-200 rounded-lg p-4">
        <p className="text-sm text-brand-800">
          <strong>💡 Tip:</strong> Click column headers to sort. Use filters to narrow your view. Click "Edit" to update task details.
        </p>
      </div>
    </div>
  );
}

// Analytics View Component - Wrike Style
function AnalyticsView({ tasks, projects, clients, teamMembers }) {
  // Calculate statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const overdueTasks = tasks.filter(t => isTaskOverdue(t)).length;
  // Per-column breakdown (built-ins + any custom Kanban columns)
  const statusCounts = loadBoardColumns().map(col => ({
    ...col,
    count: tasks.filter(t => t.status === col.id).length
  }));

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Active projects
  const activeProjects = projects.filter(p => p.status !== 'completed').length;

  // Tasks by team member
  const tasksByMember = teamMembers.map(member => ({
    name: member.name,
    total: tasks.filter(t => t.assignedTo === member.id).length,
    completed: tasks.filter(t => t.assignedTo === member.id && t.status === 'completed').length,
    inProgress: tasks.filter(t => t.assignedTo === member.id && t.status === 'in-progress').length
  })).filter(m => m.total > 0);

  const unassignedTasks = tasks.filter(t => !t.assignedTo).length;

  // Tasks by project
  const tasksByProject = projects.map(project => {
    const projectTasks = tasks.filter(t => t.projectId === project.id);
    const client = clients.find(c => c.id === project.clientId);
    return {
      name: project.name,
      client: client?.name,
      total: projectTasks.length,
      completed: projectTasks.filter(t => t.status === 'completed').length,
      completionRate: projectTasks.length > 0 ? Math.round((projectTasks.filter(t => t.status === 'completed').length / projectTasks.length) * 100) : 0
    };
  }).filter(p => p.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h2>
        <p className="text-gray-600">Insights and performance metrics</p>
      </div>

      {/* Overview Stats */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Tasks</span>
            <CheckSquare size={20} className="text-brand-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalTasks}</p>
          <p className="text-sm text-gray-600 mt-1">Across all projects</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Completion Rate</span>
            <TrendingUp size={20} className="text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{completionRate}%</p>
          <p className="text-sm text-gray-600 mt-1">{completedTasks} of {totalTasks} completed</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Active Projects</span>
            <FolderKanban size={20} className="text-brand-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{activeProjects}</p>
          <p className="text-sm text-gray-600 mt-1">Currently in progress</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Overdue Tasks</span>
            <AlertCircle size={20} className="text-red-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{overdueTasks}</p>
          <p className="text-sm text-gray-600 mt-1">Need attention</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Task Status Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Task Status</h3>
          <div className="space-y-3">
            {statusCounts.map(col => {
              const pct = totalTasks > 0 ? Math.round((col.count / totalTasks) * 100) : 0;
              return (
                <div key={col.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{col.label}</span>
                    <span className="font-semibold text-gray-900">{col.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`${COLUMN_BAR_COLORS[col.color] || 'bg-gray-600'} h-2 rounded-full`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Workload */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Team Workload</h3>
          <div className="space-y-3">
            {tasksByMember.slice(0, 5).map((member, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{member.name}</span>
                  <span className="font-semibold text-gray-900">{member.total} tasks</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-brand-600 h-2 rounded-full" style={{ width: `${(member.total / totalTasks) * 100}%` }}></div>
                </div>
              </div>
            ))}
            {unassignedTasks > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Unassigned</span>
                  <span className="font-semibold text-gray-900">{unassignedTasks} tasks</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-gray-400 h-2 rounded-full" style={{ width: `${(unassignedTasks / totalTasks) * 100}%` }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project Progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Project Progress</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Project</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Total Tasks</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Completed</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tasksByProject.map((project, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{project.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{project.client || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{project.total}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{project.completed}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                        <div 
                          className="bg-brand-600 h-2 rounded-full" 
                          style={{ width: `${project.completionRate}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{project.completionRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Workspace Access — who can log in to this workspace (members, roles, invites)
const roleBadgeClass = (r) => ({
  owner: 'bg-brand-100 text-brand-700',
  admin: 'bg-amber-100 text-amber-700',
  member: 'bg-gray-100 text-gray-600'
}[r] || 'bg-gray-100 text-gray-600');

function WorkspaceAccess({ members, invites, linkInvites, currentUserId, canManage, onInvite, onCreateLink, onCopyLink, onRevoke, onRemove }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [linkRole, setLinkRole] = useState('member');

  const submit = (e) => { e.preventDefault(); onInvite(email, role); setEmail(''); setRole('member'); };
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Workspace Access</h2>
        <p className="text-gray-600">People who can sign in to this workspace</p>
      </div>

      {canManage && (
        <form onSubmit={submit} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Invite by email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Plus size={18} /> Send invite
          </button>
        </form>
      )}

      {canManage && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Invite links</h3>
              <p className="text-xs text-gray-500">Anyone with the link can join this workspace.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={linkRole}
                onChange={e => setLinkRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() => onCreateLink(linkRole)}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Link size={16} /> Create link
              </button>
            </div>
          </div>
          {linkInvites.length > 0 && (
            <div className="space-y-2">
              {linkInvites.map(l => (
                <div key={l.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${roleBadgeClass(l.role)}`}>{l.role}</span>
                  <code className="flex-1 text-xs text-gray-600 truncate">{origin}/?join={l.token}</code>
                  <button onClick={() => onCopyLink(l.token)} className="text-gray-400 hover:text-brand-600 transition-colors flex-shrink-0" title="Copy link">
                    <Copy size={16} />
                  </button>
                  <button onClick={() => onRevoke(l.id)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0" title="Revoke link">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 uppercase">
          Members · {members.length}
        </div>
        <div className="divide-y divide-gray-100">
          {members.map(m => (
            <div key={m.id} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {((m.name || m.email || '?').trim()[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    {m.name || m.email || 'Unknown'}
                    {m.user_id === currentUserId && <span className="text-gray-400"> (you)</span>}
                  </p>
                  {m.name && <p className="text-xs text-gray-500 truncate">{m.email}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleBadgeClass(m.role)}`}>{m.role}</span>
                {canManage && m.role !== 'owner' && m.user_id !== currentUserId && (
                  <button onClick={() => onRemove(m.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Remove from workspace">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {invites.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 uppercase">
            Pending invites · {invites.length}
          </div>
          <div className="divide-y divide-gray-100">
            {invites.map(inv => (
              <div key={inv.id} className="px-6 py-3 flex items-center justify-between">
                <div className="text-sm text-gray-700 truncate">{inv.email}</div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleBadgeClass(inv.role)}`}>{inv.role}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Pending</span>
                  {canManage && (
                    <button onClick={() => onRevoke(inv.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Revoke invite">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
        <h2 className="text-3xl font-bold text-gray-900">Team Members</h2>
        <button
          onClick={onAdd}
          className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus size={20} />
          <span>Add Team Member</span>
        </button>
      </div>

      {teamMembers.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <User size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No team members yet</h3>
          <p className="text-gray-600 mb-4">Add your team members to assign tasks.</p>
          <button
            onClick={onAdd}
            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg transition-colors"
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
              <div key={member.id} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm task-card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{member.name}</h3>
                    <p className="text-gray-600">{member.role}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(member)}
                      className="text-gray-600 hover:text-brand-600 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => onDelete(member.id)}
                      className="text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                {member.email && (
                  <p className="text-sm text-gray-600 mb-4">✉️ {member.email}</p>
                )}
                
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="text-sm text-gray-600">
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
function StatCard({ label, value, icon: Icon, onClick }) {
  // Uniform brass accent for all stat cards
  const cardClass = 'bg-white border-l-4 border-l-brand-500 hover:shadow-lg';
  const iconClass = 'text-brand-500';
  
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border border-gray-200 p-6 ${cardClass} shadow-md transition-all text-left w-full`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{label}</p>
          <p className="text-4xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <Icon size={36} className={`${iconClass} opacity-60`} />
      </div>
    </button>
  );
}

function StatusBadge({ status }) {
  const statusConfig = {
    'todo': { label: 'To Do', class: 'bg-gray-100 text-gray-700' },
    'in-progress': { label: 'In Progress', class: 'bg-brand-100 text-brand-700' },
    'completed': { label: 'Completed', class: 'bg-green-100 text-green-700' },
    'planning': { label: 'Planning', class: 'bg-amber-100 text-amber-700' },
    'active': { label: 'Active', class: 'bg-brand-100 text-brand-700' },
    'on-hold': { label: 'On Hold', class: 'bg-yellow-100 text-yellow-700' }
  };
  
  // A board column (if one matches) is the source of truth for task-status labels,
  // so renames show everywhere. Fall back to statusConfig (project statuses) then raw.
  const col = loadBoardColumns().find(c => c.id === status);
  const config = col
    ? { label: col.label, class: COLUMN_COLORS[col.color] || 'bg-gray-100 text-gray-700' }
    : statusConfig[status] || { label: status, class: 'bg-gray-100 text-gray-700' };

  return (
    <span className={`status-badge px-3 py-1 rounded-full text-xs font-semibold ${config.class}`}>
      {config.label}
    </span>
  );
}

// Modal Components
function ClientModal({ client, teamMembers, onSave, onClose }) {
  const [formData, setFormData] = useState(client || {
    name: '',
    company: '',
    email: '',
    phone: '',
    assignedTo: '',
    populationSize: '',
    yearEndDate: '',
    // Strategic Information
    valueProposition: '',
    problemIssue: '',
    goalMetric: '',
    expectedDeliverables: ''
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
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {client ? 'Edit Client' : 'Add New Client'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="John Doe"
                autoFocus
                required
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Acme Corp"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="john@acme.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Team Member
              </label>
              <select
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Unassigned</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Population Size
              </label>
              <input
                type="text"
                value={formData.populationSize}
                onChange={(e) => setFormData({ ...formData, populationSize: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g., 50,000"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year-End Date
              </label>
              <input
                type="date"
                value={formData.yearEndDate}
                onChange={(e) => setFormData({ ...formData, yearEndDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-gray-500 mt-1">Fiscal year-end date for this client</p>
            </div>

            {/* Strategic Information Section */}
            <div className="col-span-2 pt-4 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Project Strategy</h3>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value Proposition
              </label>
              <textarea
                value={formData.valueProposition}
                onChange={(e) => setFormData({ ...formData, valueProposition: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="What value is the entity to get out of the project?"
                rows="3"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Problem or Issue
              </label>
              <textarea
                value={formData.problemIssue}
                onChange={(e) => setFormData({ ...formData, problemIssue: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Why is the entity switching to PBB now?"
                rows="3"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Goal/Metric
              </label>
              <textarea
                value={formData.goalMetric}
                onChange={(e) => setFormData({ ...formData, goalMetric: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="What is the measure of success for the project?"
                rows="2"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Deliverables
              </label>
              <textarea
                value={formData.expectedDeliverables}
                onChange={(e) => setFormData({ ...formData, expectedDeliverables: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="What is the client expecting to receive from us?"
                rows="3"
              />
            </div>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Save Client
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Client Detail View Component
function ClientDetailView({ client, teamMembers, onClose, onEdit }) {
  const assignedMember = teamMembers.find(m => m.id === client.assignedTo);
  
  return (
    <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-5 flex justify-between items-center rounded-t-lg">
          <div>
            <h2 className="text-2xl font-bold text-white">{client.name}</h2>
            {client.company && <p className="text-brand-100 mt-1">{client.company}</p>}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-white hover:bg-brand-50 text-brand-700 rounded-lg transition-colors font-medium"
            >
              Edit
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-brand-800 hover:bg-brand-900 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Users size={20} className="mr-2 text-brand-600" />
              Contact Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-gray-900 mt-1">{client.email || '—'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Phone</label>
                <p className="text-gray-900 mt-1">{client.phone || '—'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Assigned To</label>
                <p className="text-gray-900 mt-1">{assignedMember?.name || 'Unassigned'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Population Size</label>
                <p className="text-gray-900 mt-1">{client.populationSize || '—'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Year-End Date</label>
                <p className="text-gray-900 mt-1">
                  {client.yearEndDate ? parseLocalDate(client.yearEndDate).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Strategic Information */}
          <div className="bg-brand-50 rounded-lg p-5 border border-brand-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <LayoutDashboard size={20} className="mr-2 text-brand-600" />
              Project Strategy
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-brand-900">Value Proposition</label>
                <p className="text-gray-800 mt-1 whitespace-pre-wrap">
                  {client.valueProposition || 'Not specified'}
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold text-brand-900">Problem or Issue</label>
                <p className="text-gray-800 mt-1 whitespace-pre-wrap">
                  {client.problemIssue || 'Not specified'}
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold text-brand-900">Goal/Metric</label>
                <p className="text-gray-800 mt-1 whitespace-pre-wrap">
                  {client.goalMetric || 'Not specified'}
                </p>
              </div>
              <div>
                <label className="text-sm font-semibold text-brand-900">Expected Deliverables</label>
                <p className="text-gray-800 mt-1 whitespace-pre-wrap">
                  {client.expectedDeliverables || 'Not specified'}
                </p>
              </div>
            </div>
          </div>
        </div>
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
  const [usePBBTemplate, setUsePBBTemplate] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a project name');
      return;
    }
    onSave(formData, usePBBTemplate);
  };

  return (
    <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {project ? 'Edit Project' : 'Add New Project'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Q4 Implementation"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Project details..."
              rows="3"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client
            </label>
            <select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a client (optional)</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {!project && (
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePBBTemplate}
                  onChange={(e) => setUsePBBTemplate(e.target.checked)}
                  className="w-5 h-5 text-brand-600 border-gray-300 rounded focus:ring-2 focus:ring-brand-500"
                />
                <div>
                  <span className="font-semibold text-gray-900">Use PBB Template</span>
                  <p className="text-xs text-gray-600 mt-1">
                    Automatically create 30+ standard PBB tasks across 3 phases
                  </p>
                </div>
              </label>
            </div>
          )}
          
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Save Project
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
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
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: '',
    assignedTo: '',
    status: 'todo',
    priority: 'medium',
    startDate: '',
    dueDate: '',
    subtasks: [],
    phase: '',
    phaseName: '',
    section: '',
    sectionName: '',
    ...(task || {})
  });
  const [newSubtask, setNewSubtask] = useState('');

  const selectedProject = projects.find(p => p.id === formData.projectId);
  const selectedClient = selectedProject ? clients.find(c => c.id === selectedProject.clientId) : null;
  const isPBBProject = selectedProject?.usePBBTemplate;

  const subtasks = formData.subtasks || [];
  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title) return;
    setFormData({ ...formData, subtasks: [...subtasks, { id: Date.now().toString(), title, done: false }] });
    setNewSubtask('');
  };
  const toggleSubtask = (id) => {
    setFormData({ ...formData, subtasks: subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s) });
  };
  const removeSubtask = (id) => {
    setFormData({ ...formData, subtasks: subtasks.filter(s => s.id !== id) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Please enter a task title');
      return;
    }
    if (dateError) {
      alert('Due date cannot be before the start date.');
      return;
    }
    onSave(formData);
  };

  const dateError = formData.startDate && formData.dueDate && formData.dueDate < formData.startDate;

  const handlePhaseChange = (e) => {
    const phaseId = e.target.value;
    const phase = PBB_TEMPLATE.phases.find(p => p.id === phaseId);
    setFormData({
      ...formData,
      phase: phaseId,
      phaseName: phase?.name || '',
      section: '',
      sectionName: ''
    });
  };

  const handleSectionChange = (e) => {
    const sectionId = e.target.value;
    const phase = PBB_TEMPLATE.phases.find(p => p.id === formData.phase);
    const section = phase?.sections?.find(s => s.id === sectionId);
    setFormData({
      ...formData,
      section: sectionId,
      sectionName: section?.name || ''
    });
  };

  const currentPhase = PBB_TEMPLATE.phases.find(p => p.id === formData.phase);
  const statusColumns = loadBoardColumns();

  return (
    <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {task ? 'Edit Task' : 'Add New Task'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Complete onboarding"
              autoFocus
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Add notes, context, or details..."
              rows="3"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a project (optional)</option>
              {projects.map(project => {
                const client = clients.find(c => c.id === project.clientId);
                return (
                  <option key={project.id} value={project.id}>
                    {project.name} {client ? `(${client.name})` : ''}
                    {project.usePBBTemplate ? ' (PBB)' : ''}
                  </option>
                );
              })}
            </select>
            {selectedClient && (
              <p className="text-xs text-gray-500 mt-1">Client: {selectedClient.name}</p>
            )}
          </div>

          {isPBBProject && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phase (Optional)
                </label>
                <select
                  value={formData.phase}
                  onChange={handlePhaseChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">No specific phase</option>
                  {PBB_TEMPLATE.phases.map(phase => (
                    <option key={phase.id} value={phase.id}>{phase.name}</option>
                  ))}
                </select>
              </div>

              {currentPhase?.sections && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Section (Optional)
                  </label>
                  <select
                    value={formData.section}
                    onChange={handleSectionChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">No specific section</option>
                    {currentPhase.sections.map(section => (
                      <option key={section.id} value={section.id}>{section.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign To
            </label>
            <select
              value={formData.assignedTo}
              onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Unassigned</option>
              {teamMembers.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                min={formData.startDate || undefined}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${dateError ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-brand-500'}`}
              />
            </div>
          </div>
          {dateError && (
            <p className="text-xs text-red-600 -mt-2">Due date is before the start date.</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {statusColumns.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {PRIORITY_ORDER.map(key => (
                  <option key={key} value={key}>{PRIORITIES[key].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sub-tasks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sub-tasks {subtasks.length > 0 && (
                <span className="text-gray-400 font-normal">
                  · {subtasks.filter(s => s.done).length}/{subtasks.length} done
                </span>
              )}
            </label>
            {subtasks.length > 0 && (
              <div className="space-y-2 mb-2">
                {subtasks.map(s => (
                  <div key={s.id} className="flex items-center gap-2 group">
                    <button
                      type="button"
                      onClick={() => toggleSubtask(s.id)}
                      className="flex-shrink-0 text-gray-300 hover:text-brand-600 transition-colors"
                      title={s.done ? 'Mark not done' : 'Mark done'}
                    >
                      {s.done ? <CheckCircle size={18} className="text-green-600" /> : <Circle size={18} />}
                    </button>
                    <span className={`flex-1 text-sm ${s.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{s.title}</span>
                    <button
                      type="button"
                      onClick={() => removeSubtask(s.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                      title="Remove sub-task"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Add a sub-task and press Enter"
              />
              <button
                type="button"
                onClick={addSubtask}
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <Plus size={16} />Add
              </button>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Save Task
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a team member name');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {member ? 'Edit Team Member' : 'Add New Team Member'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Jane Smith"
              autoFocus
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Customer Success Manager"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="jane@company.com"
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Save Team Member
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add / edit a calendar event (availability or client event)
function CalendarEventModal({ event, teamMembers, clients, onSave, onDelete, onClose }) {
  const [formData, setFormData] = useState(event || {
    title: '', eventType: 'time_off', memberId: '', clientId: '',
    startDate: '', endDate: '', allDay: true, startTime: '', endTime: '', notes: ''
  });
  const cat = eventTypeMeta(formData.eventType).cat;
  const set = (patch) => setFormData(prev => ({ ...prev, ...patch }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { alert('Please enter a title'); return; }
    if (!formData.startDate) { alert('Please choose a start date'); return; }
    if (formData.endDate && formData.endDate < formData.startDate) { alert('End date cannot be before start date'); return; }
    onSave(formData);
  };

  const inputCls = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{event ? 'Edit Event' : 'Add Event'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <select value={formData.eventType} onChange={(e) => set({ eventType: e.target.value })} className={inputCls}>
              <optgroup label="Availability">
                {EVENT_TYPE_ORDER.filter(t => EVENT_TYPES[t].cat === 'avail').map(t => <option key={t} value={t}>{EVENT_TYPES[t].label}</option>)}
              </optgroup>
              <optgroup label="Client">
                {EVENT_TYPE_ORDER.filter(t => EVENT_TYPES[t].cat === 'client').map(t => <option key={t} value={t}>{EVENT_TYPES[t].label}</option>)}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input type="text" value={formData.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} placeholder={cat === 'avail' ? 'Vacation' : 'Onboarding training'} autoFocus required />
          </div>

          {cat === 'avail' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Person</label>
              <select value={formData.memberId} onChange={(e) => set({ memberId: e.target.value })} className={inputCls}>
                <option value="">— Select person —</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select value={formData.clientId} onChange={(e) => set({ clientId: e.target.value })} className={inputCls}>
                <option value="">— None —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.company}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start date *</label>
              <input type="date" value={formData.startDate} onChange={(e) => set({ startDate: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
              <input type="date" value={formData.endDate} min={formData.startDate || undefined} onChange={(e) => set({ endDate: e.target.value })} className={inputCls} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={formData.allDay} onChange={(e) => set({ allDay: e.target.checked })} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
            All day
          </label>

          {!formData.allDay && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
                <input type="time" value={formData.startTime} onChange={(e) => set({ startTime: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
                <input type="time" value={formData.endTime} onChange={(e) => set({ endTime: e.target.value })} className={inputCls} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} className={inputCls} placeholder="Optional details" />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button type="submit" className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors">Save Event</button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors">Cancel</button>
          </div>
          {event && (
            <button type="button" onClick={() => { onClose(); onDelete(event.id); }} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:text-red-700 pt-1">
              <Trash2 size={16} /> Delete event
            </button>
          )}
        </form>
      </div>
    </div>
  );
}