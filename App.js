import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Switch,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ============================================================
   1. STORAGE — semua fungsi AsyncStorage (tasks, tema, statistik)
   ============================================================ */
const STORAGE_KEYS = {
  TASKS: '@taskkeeper_tasks',
  THEME: '@taskkeeper_theme',
  STATS: '@taskkeeper_stats',
};

const loadTasks = async () => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('Gagal memuat tasks:', e);
    return [];
  }
};

const saveTasks = async (tasks) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error('Gagal menyimpan tasks:', e);
  }
};

const clearAllTasks = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.TASKS);
  } catch (e) {
    console.error('Gagal menghapus semua tasks:', e);
  }
};

const loadTheme = async () => {
  try {
    const theme = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
    return theme || 'light';
  } catch (e) {
    return 'light';
  }
};

const saveTheme = async (theme) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (e) {
    console.error('Gagal menyimpan tema:', e);
  }
};

const loadStats = async () => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.STATS);
    return json ? JSON.parse(json) : { totalCreated: 0, totalCompleted: 0 };
  } catch (e) {
    return { totalCreated: 0, totalCompleted: 0 };
  }
};

const saveStats = async (stats) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  } catch (e) {
    console.error('Gagal menyimpan statistik:', e);
  }
};

/* ============================================================
   2. THEME CONTEXT — dark mode tersimpan (fitur Level 2)
   ============================================================ */
const ThemeContext = createContext();

const lightColors = {
  background: '#F5F6FA',
  card: '#FFFFFF',
  text: '#1C1C1E',
  subtext: '#6E6E73',
  primary: '#4A6FE3',
  danger: '#E74C3C',
  border: '#E2E4EA',
  completed: '#9DA3AF',
};

const darkColors = {
  background: '#121214',
  card: '#1E1E22',
  text: '#F2F2F7',
  subtext: '#9A9AA2',
  primary: '#6C8CFF',
  danger: '#FF6B6B',
  border: '#2C2C30',
  completed: '#5C5C63',
};

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await loadTheme();
      setTheme(saved);
      setIsReady(true);
    })();
  }, []);

  const toggleTheme = async () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    await saveTheme(next);
  };

  const colors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, isReady }}>
      {children}
    </ThemeContext.Provider>
  );
}

const useTheme = () => useContext(ThemeContext);

/* ============================================================
   3. KOMPONEN — TaskItem, TaskModal, StatsBar, FilterBar
   ============================================================ */
const CATEGORIES = ['Umum', 'Kuliah', 'Kerja', 'Pribadi'];
const FILTER_CATEGORIES = ['Semua', ...CATEGORIES];
const SORT_OPTIONS = [
  { key: 'newest', label: 'Terbaru' },
  { key: 'alpha', label: 'A-Z' },
  { key: 'status', label: 'Status' },
];

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function TaskItem({ task, onToggle, onEdit, onDelete }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.checkboxArea} onPress={() => onToggle(task.id)}>
        <View
          style={[
            styles.checkbox,
            { borderColor: colors.primary },
            task.completed && { backgroundColor: colors.primary },
          ]}
        >
          {task.completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.textArea}
        onPress={() => onToggle(task.id)}
        onLongPress={() => onEdit(task)}
      >
        <Text
          style={[
            styles.title,
            { color: task.completed ? colors.completed : colors.text },
            task.completed && styles.strikethrough,
          ]}
        >
          {task.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.category, { color: colors.primary }]}>{task.category}</Text>
          <Text style={[styles.date, { color: colors.subtext }]}>{formatDate(task.createdAt)}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => onEdit(task)} style={styles.actionBtn}>
          <Text style={styles.actionIcon}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(task)} style={styles.actionBtn}>
          <Text style={styles.actionIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TaskModal({ visible, onClose, onSubmit, initialTask }) {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setTitle(initialTask ? initialTask.title : '');
      setCategory(initialTask ? initialTask.category : CATEGORIES[0]);
      setError('');
    }
  }, [visible, initialTask]);

  const handleSubmit = () => {
    // VALIDASI: tolak input kosong
    if (!title.trim()) {
      setError('Judul tugas tidak boleh kosong');
      return;
    }
    onSubmit({ title: title.trim(), category });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <Text style={[styles.heading, { color: colors.text }]}>
            {initialTask ? 'Edit Tugas' : 'Tugas Baru'}
          </Text>

          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder="Tulis tugas..."
            placeholderTextColor={colors.subtext}
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              if (error) setError('');
            }}
            autoFocus
          />
          {!!error && <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text>}

          <Text style={[styles.label, { color: colors.subtext }]}>Kategori</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={[
                  styles.chip,
                  { borderColor: colors.primary },
                  category === c && { backgroundColor: colors.primary },
                ]}
              >
                <Text style={{ color: category === c ? '#fff' : colors.primary, fontWeight: '600' }}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border }]} onPress={onClose}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleSubmit}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StatItem({ label, value, colors }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.subtext }]}>{label}</Text>
    </View>
  );
}

function StatsBar({ stats, activeCount }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <StatItem label="Aktif" value={activeCount} colors={colors} />
      <StatItem label="Total Dibuat" value={stats.totalCreated} colors={colors} />
      <StatItem label="Total Selesai" value={stats.totalCompleted} colors={colors} />
    </View>
  );
}

function FilterBar({ search, onSearchChange, category, onCategoryChange, sort, onSortChange }) {
  const { colors } = useTheme();

  return (
    <View style={{ marginBottom: 4 }}>
      <TextInput
        style={[
          styles.search,
          { borderColor: colors.border, color: colors.text, backgroundColor: colors.card },
        ]}
        placeholder="Cari tugas..."
        placeholderTextColor={colors.subtext}
        value={search}
        onChangeText={onSearchChange}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {FILTER_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => onCategoryChange(c)}
            style={[
              styles.chip,
              { borderColor: colors.primary },
              category === c && { backgroundColor: colors.primary },
            ]}
          >
            <Text style={{ color: category === c ? '#fff' : colors.primary, fontSize: 12, fontWeight: '600' }}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {SORT_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            onPress={() => onSortChange(s.key)}
            style={[
              styles.sortChip,
              { borderColor: colors.subtext },
              sort === s.key && { backgroundColor: colors.subtext },
            ]}
          >
            <Text style={{ color: sort === s.key ? '#fff' : colors.subtext, fontSize: 12 }}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

/* ============================================================
   4. APP CONTENT — logic utama CRUD + state management
   ============================================================ */
function AppContent() {
  const { colors, theme, toggleTheme, isReady } = useTheme();

  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ totalCreated: 0, totalCompleted: 0 });
  const [loaded, setLoaded] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Semua');
  const [sort, setSort] = useState('newest');

  // READ: muat data tersimpan saat app dibuka
  useEffect(() => {
    (async () => {
      const [savedTasks, savedStats] = await Promise.all([loadTasks(), loadStats()]);
      setTasks(savedTasks);
      setStats(savedStats);
      setLoaded(true);
    })();
  }, []);

  // Simpan otomatis ke AsyncStorage setiap `tasks` berubah
  useEffect(() => {
    if (loaded) saveTasks(tasks);
  }, [tasks, loaded]);

  // Simpan statistik setiap berubah
  useEffect(() => {
    if (loaded) saveStats(stats);
  }, [stats, loaded]);

  const openAddModal = () => {
    setEditingTask(null);
    setModalVisible(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setModalVisible(true);
  };

  // CREATE / UPDATE
  const handleSubmit = ({ title, category: cat }) => {
    if (editingTask) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? { ...t, title, category: cat } : t))
      );
    } else {
      const newTask = {
        id: Date.now().toString(),
        title,
        category: cat,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [newTask, ...prev]);
      setStats((prev) => ({ ...prev, totalCreated: prev.totalCreated + 1 }));
    }
    setModalVisible(false);
  };

  // UPDATE: toggle status selesai
  const handleToggle = (id) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const nowCompleted = !t.completed;
        setStats((s) => ({
          ...s,
          totalCompleted: s.totalCompleted + (nowCompleted ? 1 : -1),
        }));
        return { ...t, completed: nowCompleted };
      })
    );
  };

  // DELETE dengan konfirmasi Alert
  const handleDelete = (task) => {
    Alert.alert('Hapus Tugas', `Hapus "${task.title}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
        },
      },
    ]);
  };

  // Hapus Semua (hanya key tasks, bukan clear seluruh storage)
  const handleDeleteAll = () => {
    if (tasks.length === 0) return;
    Alert.alert('Hapus Semua Tugas', 'Semua tugas akan dihapus permanen. Lanjutkan?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus Semua',
        style: 'destructive',
        onPress: async () => {
          setTasks([]);
          await clearAllTasks();
        },
      },
    ]);
  };

  // Search + filter kategori + sorting (semua di memori)
  const getFilteredTasks = useCallback(() => {
    let result = [...tasks];

    if (category !== 'Semua') {
      result = result.filter((t) => t.category === category);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }

    if (sort === 'newest') {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'alpha') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'status') {
      result.sort((a, b) => Number(a.completed) - Number(b.completed));
    }

    return result;
  }, [tasks, search, category, sort]);

  const filteredTasks = getFilteredTasks();
  const activeCount = tasks.filter((t) => !t.completed).length;

  if (!isReady || !loaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: 40 }}>Memuat data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>📋 TaskKeeper Plus</Text>
        <View style={styles.themeSwitch}>
          <Text style={{ color: colors.subtext, marginRight: 6, fontSize: 12 }}>🌙</Text>
          <Switch value={theme === 'dark'} onValueChange={toggleTheme} />
        </View>
      </View>

      <StatsBar stats={stats} activeCount={activeCount} />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        sort={sort}
        onSortChange={setSort}
      />

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <TaskItem task={item} onToggle={handleToggle} onEdit={openEditModal} onDelete={handleDelete} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🗂️</Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              {tasks.length === 0
                ? 'Belum ada tugas.\nTekan tombol + untuk menambah.'
                : 'Tidak ada tugas yang cocok dengan pencarian/filter.'}
            </Text>
          </View>
        }
      />

      {tasks.length > 0 && (
        <TouchableOpacity style={[styles.clearAllBtn, { borderColor: colors.danger }]} onPress={handleDeleteAll}>
          <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 12 }}>🧹 Hapus Semua</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openAddModal}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <TaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
        initialTask={editingTask}
      />
    </SafeAreaView>
  );
}

/* ============================================================
   5. ROOT — bungkus dengan ThemeProvider
   ============================================================ */
export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

/* ============================================================
   6. STYLES
   ============================================================ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  themeSwitch: { flexDirection: 'row', alignItems: 'center' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  checkboxArea: { marginRight: 12 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  textArea: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  strikethrough: { textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', marginTop: 4, alignItems: 'center' },
  category: { fontSize: 12, fontWeight: '600', marginRight: 8 },
  date: { fontSize: 11 },
  actions: { flexDirection: 'row', marginLeft: 8 },
  actionBtn: { padding: 6, marginLeft: 4 },
  actionIcon: { fontSize: 16 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, marginRight: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  btn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginLeft: 10 },

  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },

  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    fontSize: 14,
  },
  filterRow: { marginHorizontal: 16, marginTop: 8 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, marginRight: 8 },

  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  clearAllBtn: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: { color: '#fff', fontSize: 30, lineHeight: 32, fontWeight: '400' },
});