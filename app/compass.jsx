import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Image,
  Platform, InputAccessoryView, Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font } from '../constants/theme';
import { getCompass, saveCompass, getRoles, saveRoles, persistCompassDone, getCompassDone } from '../store/db';
import { cancelJournalNotification } from '../notifications';
import * as haptics from '../lib/haptics';
import { useMindfulSession } from '../lib/useMindfulSession';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { PracticeHeader } from '../components/PracticeHeader';

const COMPASS_HINTS = {
  why: {
    placeholder: "e.g. To act with integrity regardless of outcome. To be the kind of person my future self would be proud of.",
    hint: "The Stoics distinguished sharply between what is 'up to us' and what is not. Your Why should live entirely in the first category — character, intention, how you show up — not outcomes, status, or what others think of you.\n\nAsk: is this something I could achieve even if everything around me went wrong? If yes, it is a Stoic Why. If it depends on external circumstances going your way, return to what is in your control.\n\nMarcus Aurelius' unspoken Why was simple: to be a just and rational man, regardless of whether his empire prospered.",
  },
  aspire: {
    placeholder: "e.g. To respond to difficulty with reason rather than reaction. To be present with the people I love.",
    hint: "Aspiration in Stoic terms is the cultivation of Virtue, not achievement of outcomes. The four Virtues are Wisdom, Courage, Temperance, and Justice.\n\nThe test: does your aspiration describe who you are becoming, or what you are getting? 'I aspire to be promoted' is external. 'I aspire to do work worthy of recognition' is internal.\n\nEpictetus: 'First say to yourself what you would be; then do what you have to do.'",
  },
  overcome: {
    placeholder: "e.g. My tendency to avoid difficult conversations. Mistaking busyness for progress.",
    hint: "Name a pattern you can observe in yourself, not a circumstance or another person. Those are outside your control.\n\nWhat you can overcome is your habitual judgment about events. 'I want to overcome anxiety' is external. 'I want to stop treating anxiety as a verdict rather than an impression' is internal.\n\nThat distinction is where the Stoic practice lives.",
  },
  roles: {
    hint: "The Stoics called these your kathēkonta: the appropriate actions owed to others by virtue of the position you occupy. You are not just one person. You are a parent or child, a partner, a friend, a colleague, a citizen, a human being among other rational creatures.\n\nEach role asks something specific of you. Naming the roles that actually apply to your life, not titles or aspirations but real relational positions, is the first move. The second is asking, regularly, what each one requires of you right now.\n\nMarcus Aurelius reminded himself of his roles every morning. So can you.",
  },
};

const tabs = ['Why', 'Overcome', 'Aspire', 'Roles'];
const tabKeys = ['why', 'overcome', 'aspire'];

// Suggested roles offered in the empty state. Users tap to add. Kept
// short so it doesn't read as prescriptive — these are starting points,
// not a checklist. Custom roles are also supported.
const ROLE_SUGGESTIONS = [
  'Partner',
  'Parent',
  'Child',
  'Sibling',
  'Friend',
  'Colleague',
  'Neighbor',
  'Citizen',
  'Human being',
];

// Per-role placeholder one-liners. Surfaced as `e.g. ...` hints in the
// editor and as a faint preview on a role card with no commitment yet.
// Never written as a saved value — kathēkonta is the user's own answer,
// the placeholder just lowers the blank-page barrier.
const ROLE_PLACEHOLDERS = {
  partner: 'To bring my full presence home. To assume the best.',
  parent: 'To be the calm in the room. To listen before correcting.',
  child: 'To honor the bond, even when we disagree. To call without being asked.',
  sibling: 'To keep the bond from going quiet. To show up plainly.',
  friend: 'To show up before being needed. To remember what matters to them.',
  colleague: 'To do work I can sign my name to. To be useful, not impressive.',
  neighbor: 'To notice. To be the help that is actually nearby.',
  citizen: 'To act on what I owe the common good, however small.',
  'human being': 'To remember everyone is fighting something. To be just.',
};
const DEFAULT_ROLE_PLACEHOLDER = 'e.g. To listen first. To be the steady one.';

function placeholderFor(name) {
  const key = (name || '').trim().toLowerCase();
  return ROLE_PLACEHOLDERS[key] || null;
}

export default function CompassScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  // Allow callers to deep-link to the Roles tab via ?tab=roles
  // (used by the daily Role card on Practice).
  const initialTabIdx = params?.tab === 'roles' ? 3 : 0;
  const [activeTab, setActiveTab] = useState(initialTabIdx);
  const [compass, setCompass] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [hintOpen, setHintOpen] = useState(false);
  const commitMindfulSession = useMindfulSession();
  const playerInset = useMiniPlayerInset();
  // Roles tab state — list of {id, name, commitment}. editingRole is
  // either null (list view), 'new' (creating), or a role id (editing).
  const [roles, setRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [roleNameDraft, setRoleNameDraft] = useState('');
  const [roleCommitmentDraft, setRoleCommitmentDraft] = useState('');
  const editInputRef = useRef(null);
  const roleNameInputRef = useRef(null);
  const roleCommitmentInputRef = useRef(null);
  const scrollRef = useRef(null);
  // Ref so markCompassDone is no-op after the first call per visit, even
  // before async persist completes. Reset on blur via useFocusEffect cleanup.
  const compassMarkedRef = useRef(false);

  useEffect(() => {
    getCompass().then(setCompass);
    getRoles().then(setRoles);
  }, []);

  async function markCompassDone() {
    if (compassMarkedRef.current) return;
    compassMarkedRef.current = true;
    await persistCompassDone();
    cancelJournalNotification('compass');
  }

  useFocusEffect(useCallback(() => {
    setHintOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    // Compass counts as "done" after genuine engagement — 5s on the
    // screen — rather than the moment of navigation. If already done today,
    // skip the timer; tab switches below also short-circuit.
    let timer = null;
    (async () => {
      const alreadyDone = await getCompassDone();
      if (alreadyDone) {
        compassMarkedRef.current = true;
        return;
      }
      timer = setTimeout(() => { markCompassDone(); }, 5000);
    })();

    return () => {
      if (timer) clearTimeout(timer);
      compassMarkedRef.current = false;
    };
  }, []));

  function startEditRole(role) {
    setEditingRole(role.id);
    setRoleNameDraft(role.name);
    setRoleCommitmentDraft(role.commitment || '');
  }

  function startNewRole(prefilledName = '') {
    setEditingRole('new');
    setRoleNameDraft(prefilledName);
    setRoleCommitmentDraft('');
  }

  function cancelRoleEdit() {
    setEditingRole(null);
    setRoleNameDraft('');
    setRoleCommitmentDraft('');
  }

  async function handleSaveRole() {
    const name = roleNameDraft.trim();
    if (!name) return;
    const commitment = roleCommitmentDraft.trim();
    let next;
    if (editingRole === 'new') {
      next = [...roles, { id: Date.now().toString(), name, commitment }];
    } else {
      next = roles.map(r => r.id === editingRole ? { ...r, name, commitment } : r);
    }
    await saveRoles(next);
    haptics.action();
    setRoles(next);
    cancelRoleEdit();
  }

  // Single-tap add for suggestion pills. Adds the role with empty
  // commitment so the pill flow stays one-tap. User can fill in a
  // commitment later by tapping the role card.
  async function quickAddRole(name) {
    if (roles.some(r => r.name.toLowerCase() === name.toLowerCase())) return;
    const next = [...roles, { id: Date.now().toString(), name, commitment: '' }];
    await saveRoles(next);
    haptics.tap();
    setRoles(next);
  }

  async function handleDeleteRole(id) {
    const next = roles.filter(r => r.id !== id);
    await saveRoles(next);
    haptics.tap();
    setRoles(next);
    cancelRoleEdit();
  }

  async function handleSave() {
    const key = tabKeys[activeTab];
    const updated = { ...compass, [key]: draft };
    await saveCompass(updated);
    haptics.action();
    commitMindfulSession();
    setCompass(updated);
    setEditing(false);
  }

  function startEdit() {
    setDraft(compass[tabKeys[activeTab]] || '');
    setEditing(true);
  }

  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => editInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [editing]);

  if (!compass) return <SafeAreaView style={s.safe} />;

  return (
    <SafeAreaView style={s.safe}>
      <PracticeHeader current="compass" />
      <ScrollView
        ref={scrollRef}
        style={[s.scroll, { backgroundColor: colors.bgCard }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: playerInset }}
      >

        <View style={s.hero}>
          <Image
            source={require('../assets/heroes/compass.jpg')}
            style={s.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.55, 0.8, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.heroContent}>
            <Text style={s.title}>Your North Star</Text>
          </View>
        </View>

        <View style={s.navRow}>
          {tabs.map((t, i) => (
            <TouchableOpacity
              key={t}
              style={[s.navPill, activeTab === i && s.navPillActive]}
              onPress={() => { setActiveTab(i); setEditing(false); setHintOpen(false); markCompassDone(); }}
            >
              <Text style={[s.navPillText, activeTab === i && s.navPillTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.body}>
          {activeTab < 3 ? (
            editing ? (
              <View>
                <View style={s.hintRow}>
                  <Text style={s.hintLabel}>{tabs[activeTab]}</Text>
                  <TouchableOpacity style={s.hintBtn} onPress={() => setHintOpen(!hintOpen)} activeOpacity={0.7}>
                    <Text style={s.hintBtnText}>ⓘ</Text>
                  </TouchableOpacity>
                </View>
                {hintOpen && COMPASS_HINTS[tabKeys[activeTab]] && (
                  <View style={s.hintBox}>
                    <Text style={s.hintText}>{COMPASS_HINTS[tabKeys[activeTab]].hint}</Text>
                  </View>
                )}
                <TextInput
                  ref={editInputRef}
                  style={s.editInput}
                  multiline
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={COMPASS_HINTS[tabKeys[activeTab]]?.placeholder || ''}
                  placeholderTextColor={colors.textDim}
                  scrollEnabled={false}
                  keyboardAppearance="dark"
                  inputAccessoryViewID={Platform.OS === 'ios' ? 'compassEditAccessory' : undefined}
                />
              </View>
            ) : (
              <View>
                <View style={s.hintRow}>
                  <Text style={s.hintLabel}>{tabs[activeTab]}</Text>
                  <TouchableOpacity style={s.hintBtn} onPress={() => setHintOpen(!hintOpen)} activeOpacity={0.7}>
                    <Text style={s.hintBtnText}>ⓘ</Text>
                  </TouchableOpacity>
                </View>
                {hintOpen && COMPASS_HINTS[tabKeys[activeTab]] && (
                  <View style={s.hintBox}>
                    <Text style={s.hintText}>{COMPASS_HINTS[tabKeys[activeTab]].hint}</Text>
                  </View>
                )}
                <View style={s.textCard}>
                  <Text style={s.bodyText}>{compass[tabKeys[activeTab]]}</Text>
                </View>
                <TouchableOpacity style={s.editTrigger} onPress={startEdit}>
                  <Text style={s.editTriggerText}>Edit this section</Text>
                </TouchableOpacity>
              </View>
            )
          ) : activeTab === 3 ? (
            <View>
              <View style={roles.length > 0 ? s.hintRow : s.hintRowRight}>
                {roles.length > 0 && <Text style={s.hintLabel}>Your roles</Text>}
                <TouchableOpacity style={s.hintBtn} onPress={() => setHintOpen(!hintOpen)} activeOpacity={0.7}>
                  <Text style={s.hintBtnText}>ⓘ</Text>
                </TouchableOpacity>
              </View>
              {hintOpen && (
                <View style={s.hintBox}>
                  <Text style={s.hintText}>{COMPASS_HINTS.roles.hint}</Text>
                </View>
              )}

              {editingRole ? (
                <View>
                  <View style={s.roleEditHeader}>
                    <Text style={s.roleEditLabel}>{editingRole === 'new' ? 'Add a role' : 'Edit role'}</Text>
                    {editingRole !== 'new' && (
                      <TouchableOpacity
                        onPress={() => handleDeleteRole(editingRole)}
                        style={s.roleDeleteChip}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                      >
                        <Text style={s.roleDeleteChipText}>Delete</Text>
                        <Ionicons name="trash-outline" size={14} color={colors.accent} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    ref={roleNameInputRef}
                    style={s.roleNameInput}
                    value={roleNameDraft}
                    onChangeText={setRoleNameDraft}
                    placeholder="Name (e.g. Parent, Citizen)"
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="words"
                    autoFocus
                    keyboardAppearance="dark"
                    inputAccessoryViewID={Platform.OS === 'ios' ? 'roleNameAccessory' : undefined}
                  />
                  <Text style={s.roleEditSub}>What does this role ask of you? (Optional, one line.)</Text>
                  <TextInput
                    ref={roleCommitmentInputRef}
                    style={s.roleCommitmentInput}
                    multiline
                    value={roleCommitmentDraft}
                    onChangeText={setRoleCommitmentDraft}
                    placeholder={placeholderFor(roleNameDraft)
                      ? `e.g. ${placeholderFor(roleNameDraft)}`
                      : DEFAULT_ROLE_PLACEHOLDER}
                    placeholderTextColor={colors.textDim}
                    scrollEnabled={false}
                    keyboardAppearance="dark"
                    inputAccessoryViewID={Platform.OS === 'ios' ? 'roleCommitmentAccessory' : undefined}
                  />
                </View>
              ) : (
                <View>
                  {roles.length === 0 && (
                    <Text style={s.rolesEmpty}>Choose the roles that actually apply to you. Tap any suggestion below to add it. You can write a personal commitment later by tapping the role card.</Text>
                  )}

                  {roles.length > 0 && (
                    <>
                      {roles.map(role => (
                        <TouchableOpacity
                          key={role.id}
                          style={s.roleCard}
                          onPress={() => startEditRole(role)}
                          activeOpacity={0.75}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={s.roleName}>{role.name}</Text>
                            {role.commitment ? (
                              <Text style={s.roleCommitment}>{role.commitment}</Text>
                            ) : placeholderFor(role.name) ? (
                              <Text style={s.roleCommitmentEmpty}>e.g. {placeholderFor(role.name)}</Text>
                            ) : (
                              <Text style={s.roleCommitmentEmpty}>Tap to add a commitment.</Text>
                            )}
                          </View>
                          <Text style={s.roleChev}>›</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {(() => {
                    const remaining = ROLE_SUGGESTIONS.filter(
                      name => !roles.some(r => r.name.toLowerCase() === name.toLowerCase())
                    );
                    if (remaining.length === 0) return null;
                    return (
                      <View style={{ marginTop: roles.length > 0 ? 16 : 0 }}>
                        {roles.length > 0 && (
                          <Text style={s.roleSectionLabel}>Suggested</Text>
                        )}
                        <View style={s.roleSuggestRow}>
                          {remaining.map(name => (
                            <TouchableOpacity
                              key={name}
                              style={s.roleSuggestPill}
                              onPress={() => quickAddRole(name)}
                              activeOpacity={0.7}
                            >
                              <Text style={s.roleSuggestText}>+ {name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })()}

                  <TouchableOpacity style={s.roleAddBtn} onPress={() => startNewRole()} activeOpacity={0.7}>
                    <Text style={s.roleAddBtnText}>+ Add a custom role</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : null}
        </View>

      </ScrollView>
      {Platform.OS === 'ios' && (
        <>
          <InputAccessoryView nativeID="compassEditAccessory">
            <View style={s.accessoryBarPair}>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => { Keyboard.dismiss(); setEditing(false); }}
                activeOpacity={0.8}
              >
                <Text style={s.editBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.editBtn, s.editBtnSave]}
                onPress={() => { Keyboard.dismiss(); handleSave(); }}
                activeOpacity={0.8}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]}>Save</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
          <InputAccessoryView nativeID="roleNameAccessory">
            <View style={s.accessoryBarPair}>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => { Keyboard.dismiss(); cancelRoleEdit(); }}
                activeOpacity={0.8}
              >
                <Text style={s.editBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.editBtn, s.editBtnSave]}
                onPress={() => { haptics.tap(); roleCommitmentInputRef.current?.focus(); }}
                activeOpacity={0.8}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]}>Next</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
          <InputAccessoryView nativeID="roleCommitmentAccessory">
            <View style={s.accessoryBarPair}>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => { Keyboard.dismiss(); cancelRoleEdit(); }}
                activeOpacity={0.8}
              >
                <Text style={s.editBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.editBtn, s.editBtnSave]}
                onPress={() => { Keyboard.dismiss(); handleSaveRole(); }}
                activeOpacity={0.8}
              >
                <Text style={[s.editBtnText, s.editBtnSaveText]}>
                  {editingRole === 'new' ? 'Add' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { flex: 1 },
  // Dark header with hero image
  hero: {
    backgroundColor: colors.bgDeep,
    minHeight: 280,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroContent: { padding: spacing.xl, paddingTop: 52 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  navRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  navPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.bg,
  },
  navPillActive: {
    backgroundColor: colors.accent,
  },
  navPillText: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.accent, fontWeight: '500' },
  navPillTextActive: { color: '#1a1a1a' },
  // Light reading/editing body
  body: { padding: spacing.md, paddingTop: spacing.lg, backgroundColor: colors.bgCard },
  textCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 22, marginBottom: 14, backgroundColor: colors.bgElevated,
  },
  bodyText: { fontSize: 17, color: colors.textSecondary, lineHeight: 28 },
  // Secondary button from Valeriya's library — outlined gold, dark bg,
  // gold text. Matches the nav pill / Cancel pair tokens for consistency.
  editTrigger: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  editTriggerText: { fontSize: 14, fontWeight: '500', color: colors.accent, letterSpacing: 0.3 },
  editInput: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.lg,
    padding: 18, fontSize: 16, color: colors.textPrimary, lineHeight: 26,
    minHeight: 240, textAlignVertical: 'top', marginBottom: 12,
    backgroundColor: colors.bgElevated,
  },
  // Cancel / Save pair per Valeriya's library — H56 outlined-gold + filled-gold
  // pair, more square than pill (radius.sm). Side-by-side via flex: 1 so the
  // pair stays intact on small screens (labels are short, no min-width).
  editBtns: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  editBtn: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnSave: { backgroundColor: colors.accent },
  editBtnText: { fontSize: 14, fontWeight: '500', color: colors.accent, letterSpacing: 0.3 },
  editBtnSaveText: { color: '#1a1a1a' },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 14 },

  // Roles tab
  rolesEmpty: { fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 18, fontStyle: 'italic' },
  roleSectionLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 20 },
  roleSuggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  roleSuggestPill: {
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.accentBg,
  },
  roleSuggestText: { fontSize: 13, color: colors.accent, letterSpacing: 0.3 },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 16, marginBottom: 8, backgroundColor: colors.bgElevated,
  },
  roleName: { fontSize: 16, fontWeight: '500', color: colors.textSecondary, marginBottom: 2 },
  roleCommitment: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  roleCommitmentEmpty: { fontSize: 13, color: colors.textDim, fontStyle: 'italic' },
  roleChev: { fontSize: 22, color: colors.textDim, marginLeft: 8 },
  roleAddBtn: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.md,
    padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 28,
  },
  roleAddBtnText: { fontSize: 13, color: colors.textMuted, letterSpacing: 0.5 },
  roleEditLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase' },
  // Header row for the role-edit form: section label on the left, Delete
  // chip on the right (only when editing an existing role). Keeps the
  // delete affordance visible without scrolling past the keyboard.
  roleEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  roleDeleteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
  },
  roleDeleteChipText: { fontSize: 12, fontWeight: '600', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  roleEditSub: { fontSize: 13, color: colors.textMuted, marginTop: 14, marginBottom: 8 },
  roleNameInput: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.lg,
    padding: 18, fontSize: 16, color: colors.textPrimary, lineHeight: 26,
    backgroundColor: colors.bgElevated,
  },
  roleCommitmentInput: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.lg,
    padding: 18, fontSize: 16, color: colors.textPrimary, lineHeight: 26,
    minHeight: 120, textAlignVertical: 'top',
    backgroundColor: colors.bgElevated, marginBottom: 12,
  },
  // Hint styles
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  // Right-aligned ⓘ-only row used on the Roles tab where the "Roles" label
  // would duplicate the "Your roles" section header below.
  hintRowRight: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  hintLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase' },
  hintBtn: { padding: 6 },
  hintBtnText: { fontSize: 20, color: colors.accent },
  hintBox: { backgroundColor: colors.bgDeep, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 16, marginBottom: 14 },
  hintText: { fontSize: 15, color: colors.textSecondary, lineHeight: 24 },
  accessoryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  // Compass-edit accessory: Cancel + Save pair docked above the keyboard.
  // Uses the same editBtn / editBtnSave library tokens as the in-screen
  // pair would, with flex: 1 so each takes half the bar width.
  accessoryBarPair: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  accessoryDone: { paddingVertical: 6, paddingHorizontal: 8 },
  accessoryDoneText: { fontSize: 14, color: colors.textDim, letterSpacing: 0.3 },
  accessoryAction: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 0.5, borderColor: colors.accentDim, backgroundColor: colors.accentBg },
  accessoryActionText: { fontSize: 13, fontWeight: '600', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
});