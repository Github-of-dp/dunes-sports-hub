// Replace with your Supabase credentials
const SUPABASE_URL = "https://agpxofzartbkgelljmeo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_oxkPdxHk477KlXVJSpxVmA_TGRnrWh1";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let appState = { teams: [], players: [], matches: [] };
let adminKey = "";

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`section-${tabId}`).classList.remove('hidden');

    document.querySelectorAll('nav button').forEach(btn => {
        btn.className = "text-xs font-bold text-gray-400 px-4 py-2 rounded-lg transition hover:text-white";
    });
    document.getElementById(`tab-btn-${tabId}`).className = "text-xs font-bold px-4 py-2 rounded-lg bg-maroonTheme text-white transition shadow";

    if (tabId === 'standings') fetchStandings();
    if (tabId === 'stats') fetchPlayers();
}

async function fetchInitialData() {
    try {
        const { data: teams } = await supabaseClient.from('teams').select('*').order('points', { ascending: false });
        const { data: players } = await supabaseClient.from('players').select('*').order('spike_points', { ascending: false });
        const { data: matches } = await supabaseClient.from('matches').select(`
            *,
            team_a:teams!matches_team_a_id_fkey(name, house),
            team_b:teams!matches_team_b_id_fkey(name, house)
        `).order('id', { ascending: false });

        appState = { teams: teams || [], players: players || [], matches: matches || [] };
        renderLiveMatch();
    } catch (err) {
        console.error("Error fetching data from Supabase:", err);
    }
}

function renderLiveMatch() {
    const liveMatch = appState.matches.find(m => m.status === 'LIVE') || appState.matches[0];
    if (!liveMatch) return;

    document.getElementById('team-a-name').textContent = liveMatch.team_a?.name || 'Team A';
    document.getElementById('team-b-name').textContent = liveMatch.team_b?.name || 'Team B';
    document.getElementById('team-a-sets').textContent = liveMatch.team_a_sets;
    document.getElementById('team-b-sets').textContent = liveMatch.team_b_sets;
    document.getElementById('live-court').textContent = liveMatch.court || 'Main Court';
    document.getElementById('live-mvp').textContent = liveMatch.mvp_name || 'Pending...';
    
    const badge = document.getElementById('match-status-badge');
    badge.textContent = liveMatch.status;
    badge.className = liveMatch.status === 'LIVE' 
        ? "mt-2 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
        : "mt-2 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded bg-stone-800 text-stone-300";
}

async function fetchStandings() {
    const { data: teams } = await supabaseClient.from('teams').select('*').order('points', { ascending: false });
    const tbody = document.getElementById('standings-tbody');
    tbody.innerHTML = (teams || []).map(t => `
        <tr class="hover:bg-white/[0.02]">
            <td class="py-3 pl-2 font-bold text-white">${t.name} <span class="text-xs text-gray-400 font-normal">(${t.house})</span></td>
            <td class="py-3 text-center text-gray-300 font-mono">${t.played}</td>
            <td class="py-3 text-center text-emerald-400 font-mono">${t.won}</td>
            <td class="py-3 text-center text-rose-400 font-mono">${t.lost}</td>
            <td class="py-3 text-center text-gray-300 font-mono">${t.sets_won}</td>
            <td class="py-3 text-center text-gray-300 font-mono">${t.sets_lost}</td>
            <td class="py-3 text-center font-black text-amber-400 font-mono text-base">${t.points}</td>
        </tr>
    `).join('');
}

async function fetchPlayers() {
    const { data: players } = await supabaseClient.from('players').select('*').order('spike_points', { ascending: false });
    const tbody = document.getElementById('players-tbody');
    tbody.innerHTML = (players || []).map(p => `
        <tr class="hover:bg-white/[0.02]">
            <td class="py-3 pl-2 font-bold text-white">${p.name}</td>
            <td class="py-3 px-3 text-gray-400">${p.grade || 'N/A'}</td>
            <td class="py-3 text-center font-black text-amber-400 font-mono">${p.spike_points}</td>
            <td class="py-3 text-center text-gray-300 font-mono">${p.blocks}</td>
            <td class="py-3 text-center text-gray-300 font-mono">${p.aces}</td>
        </tr>
    `).join('');
}

function toggleAdminModal() {
    const modal = document.getElementById('admin-modal');
    modal.classList.toggle('hidden');
    modal.classList.toggle('flex');
}

function authenticateAdmin() {
    const passkey = document.getElementById('admin-passkey').value;
    if (passkey === "DUNES2026") {
        adminKey = passkey;
        document.getElementById('admin-auth').classList.add('hidden');
        document.getElementById('admin-controls').classList.remove('hidden');

        const select = document.getElementById('admin-match-select');
        select.innerHTML = appState.matches.map(m => `
            <option value="${m.id}">Match #${m.id}: ${m.team_a?.name} vs ${m.team_b?.name} (${m.status})</option>
        `).join('');
    } else {
        alert("Incorrect Admin Passkey! Default is DUNES2026");
    }
}

async function saveMatchUpdate() {
    const matchId = document.getElementById('admin-match-select').value;
    const team_a_sets = parseInt(document.getElementById('admin-team-a-sets').value) || 0;
    const team_b_sets = parseInt(document.getElementById('admin-team-b-sets').value) || 0;
    const status = document.getElementById('admin-match-status').value;
    const mvp_name = document.getElementById('admin-mvp').value;

    const { error } = await supabaseClient
        .from('matches')
        .update({ team_a_sets, team_b_sets, status, mvp_name })
        .eq('id', matchId);

    if (error) {
        alert("Failed to update match: " + error.message);
    } else {
        alert("Match updated successfully!");
        toggleAdminModal();
        fetchInitialData();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    fetchInitialData();
    // Realtime listener for live score updates
    supabaseClient
        .channel('public:matches')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
            fetchInitialData();
        })
        .subscribe();
});