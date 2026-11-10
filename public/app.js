// Replace with your Supabase credentials
const SUPABASE_URL = "https://agpxofzartbkgelljmeo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_oxkPdxHk477KlXVJSpxVmA_TGRnrWh1";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentSport = null;
let appData = { teams: [], players: [], matches: [] };

// Sport selection handling on index.html
function selectSport(sport) {
    currentSport = sport;
    document.getElementById('sport-selector-view').classList.add('hidden');
    document.getElementById('sport-dashboard-view').classList.remove('hidden');
    document.getElementById('active-sport-title').textContent = sport.toUpperCase();
    
    // Configure sport-specific headers
    if (sport === 'football') {
        document.getElementById('table-title').textContent = "Football House Points & Goal Difference (GD)";
        document.getElementById('col-extra').textContent = "GD";
    } else if (sport === 'cricket') {
        document.getElementById('table-title').textContent = "Cricket House Standings & Net Run Rate (NRR)";
        document.getElementById('col-extra').textContent = "NRR";
    } else if (sport === 'volleyball') {
        document.getElementById('table-title').textContent = "Volleyball Set Standings & Points";
        document.getElementById('col-extra').textContent = "Sets Ratio";
    } else {
        document.getElementById('table-title').textContent = "Basketball Standings & Basket Difference";
        document.getElementById('col-extra').textContent = "Diff";
    }

    switchSportTab('live');
    loadSportData();
}

function backToSelector() {
    currentSport = null;
    document.getElementById('sport-dashboard-view').classList.add('hidden');
    document.getElementById('sport-selector-view').classList.remove('hidden');
}

function switchSportTab(tabId) {
    ['live', 'table', 'matches', 'playerStats', 'teams'].forEach(t => {
        const el = document.getElementById(`section-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        if (t === tabId) {
            el.classList.remove('hidden');
            btn.className = "px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-[#7A1C2E] text-white transition shadow-sm whitespace-nowrap";
        } else {
            el.classList.add('hidden');
            btn.className = "px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-stone-100 text-stone-700 hover:bg-stone-200 transition whitespace-nowrap";
        }
    });
}

async function loadSportData() {
    if (!currentSport) return;
    try {
        const { data: teams } = await supabaseClient.from('teams').select('*').eq('sport', currentSport).order('points', { ascending: false });
        const { data: players } = await supabaseClient.from('players').select('*').eq('sport', currentSport);
        const { data: matches } = await supabaseClient.from('matches').select(`
            *,
            team_a:teams!matches_team_a_id_fkey(name, house),
            team_b:teams!matches_team_b_id_fkey(name, house)
        `).eq('sport', currentSport);

        appData = { teams: teams || [], players: players || [], matches: matches || [] };

        renderLiveSection();
        renderStandingsSection();
        renderMatchesSection();
        renderPlayerStatsSection();
        renderTeamsSection();
    } catch (err) {
        console.error("Error loading sport data:", err);
    }
}

function renderLiveSection() {
    const liveMatch = appData.matches.find(m => m.status === 'LIVE') || appData.matches[0];
    if (!liveMatch) return;

    document.getElementById('live-team-a').textContent = liveMatch.team_a?.name || 'Team A';
    document.getElementById('live-team-b').textContent = liveMatch.team_b?.name || 'Team B';
    document.getElementById('live-score-a').textContent = liveMatch.score_a;
    document.getElementById('live-score-b').textContent = liveMatch.score_b;
    document.getElementById('live-venue').textContent = liveMatch.venue || 'Main Ground';
    document.getElementById('live-mvp').textContent = liveMatch.mvp_name || 'Pending...';
    document.getElementById('live-status').textContent = liveMatch.status;
}

function renderStandingsSection() {
    const tbody = document.getElementById('standings-tbody');
    tbody.innerHTML = appData.teams.map(t => `
        <tr class="hover:bg-stone-50">
            <td class="p-3 font-bold text-stone-900">${t.name} <span class="text-xs text-stone-500 font-normal">(${t.house})</span></td>
            <td class="p-3 text-center text-stone-600">${t.played}</td>
            <td class="p-3 text-center text-emerald-700 font-bold">${t.won}</td>
            <td class="p-3 text-center text-rose-700 font-bold">${t.lost}</td>
            <td class="p-3 text-center text-stone-600 font-mono">${t.extra_metric || 0}</td>
            <td class="p-3 text-center font-black text-[#7A1C2E] text-base">${t.points}</td>
        </tr>
    `).join('');
}

function renderMatchesSection() {
    const container = document.getElementById('matches-container');
    container.innerHTML = appData.matches.map(m => `
        <div class="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-3">
            <div class="flex justify-between items-center text-xs">
                <span class="font-bold text-[#7A1C2E]">Match #${m.id}</span>
                <span class="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${m.status === 'LIVE' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-stone-200 text-stone-700'}">${m.status}</span>
            </div>
            <div class="flex justify-between items-center font-bold text-sm text-stone-900">
                <span>${m.team_a?.name || 'Team A'}</span>
                <span class="font-mono text-base text-[#7A1C2E]">${m.score_a} - ${m.score_b}</span>
                <span>${m.team_b?.name || 'Team B'}</span>
            </div>
            <div class="text-[11px] text-stone-500 flex justify-between pt-1 border-t border-stone-200">
                <span><i class="fa-solid fa-star text-amber-500"></i> MVP: ${m.mvp_name || 'N/A'}</span>
                <span>${m.match_date ? new Date(m.match_date).toLocaleDateString() : 'Scheduled'}</span>
            </div>
        </div>
    `).join('');
}

function renderPlayerStatsSection() {
    // Dynamically populated leaderboard categories
    const sorted = [...appData.players].sort((a, b) => b.stat_primary - a.stat_primary);
    
    document.getElementById('stat-col-1-title').textContent = currentSport === 'football' ? 'Golden Boot (Goals)' : currentSport === 'cricket' ? 'Orange Cap (Runs)' : currentSport === 'volleyball' ? 'Top Spike Points' : 'Top Scorers (Points)';
    document.getElementById('stat-col-1-list').innerHTML = sorted.slice(0, 5).map((p, i) => `
        <div class="flex justify-between items-center p-2 rounded-xl bg-stone-50 border border-stone-200">
            <div><strong class="text-stone-900">#0${i+1} ${p.name}</strong><span class="block text-[10px] text-stone-500">${p.grade}</span></div>
            <span class="font-black text-[#7A1C2E] font-mono text-sm">${p.stat_primary}</span>
        </div>
    `).join('');

    const sortedSec = [...appData.players].sort((a, b) => b.stat_secondary - a.stat_secondary);
    document.getElementById('stat-col-2-title').textContent = currentSport === 'football' ? 'Top Assists' : currentSport === 'cricket' ? 'Purple Cap (Wickets)' : currentSport === 'volleyball' ? 'Blocks & Aces' : 'Assists / Rebounds';
    document.getElementById('stat-col-2-list').innerHTML = sortedSec.slice(0, 5).map((p, i) => `
        <div class="flex justify-between items-center p-2 rounded-xl bg-stone-50 border border-stone-200">
            <div><strong class="text-stone-900">#0${i+1} ${p.name}</strong><span class="block text-[10px] text-stone-500">${p.grade}</span></div>
            <span class="font-black text-stone-700 font-mono text-sm">${p.stat_secondary}</span>
        </div>
    `).join('');

    document.getElementById('stat-col-3-title').textContent = 'Player Rating / MVP Index';
    document.getElementById('stat-col-3-list').innerHTML = sorted.slice(0, 5).map((p, i) => `
        <div class="flex justify-between items-center p-2 rounded-xl bg-stone-50 border border-stone-200">
            <div><strong class="text-stone-900">${p.name}</strong><span class="block text-[10px] text-stone-500">Matches Played: ${p.matches_played || 0}</span></div>
            <span class="font-bold text-amber-600"><i class="fa-solid fa-star text-amber-500 text-[10px]"></i> 9.${i}</span>
        </div>
    `).join('');
}

function renderTeamsSection() {
    const container = document.getElementById('teams-directory-container');
    container.innerHTML = appData.teams.map(team => {
        const teamPlayers = appData.players.filter(p => p.team_id === team.id);
        return `
            <div class="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-3">
                <div class="flex justify-between items-center border-b border-stone-200 pb-2">
                    <h4 class="font-bold text-stone-900 text-sm">${team.name} <span class="text-xs text-stone-500 font-normal">(${team.house})</span></h4>
                    <span class="text-[10px] font-bold text-[#7A1C2E] bg-[#7A1C2E]/10 px-2 py-0.5 rounded">Points: ${team.points}</span>
                </div>
                <div class="space-y-1 text-xs">
                    <span class="text-[10px] font-bold uppercase text-stone-400">Squad Members:</span>
                    <div class="grid grid-cols-2 gap-1 text-stone-700">
                        ${teamPlayers.length ? teamPlayers.map(p => `<div>• ${p.name} (${p.grade})</div>`).join('') : '<span class="italic text-stone-400">Players registering soon...</span>'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// --- ADMIN PORTAL LOGIC ---
function verifyAdminPasskey() {
    const passkey = document.getElementById('admin-passkey-input').value;
    if (passkey === "DUNES2026") {
        document.getElementById('admin-auth-card').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        loadAdminMatchData();
    } else {
        alert("Incorrect Passkey! Default is DUNES2026");
    }
}

async function loadAdminMatchData() {
    const sport = document.getElementById('admin-sport-select').value;
    const { data: matches } = await supabaseClient.from('matches').select(`
        *,
        team_a:teams!matches_team_a_id_fkey(name),
        team_b:teams!matches_team_b_id_fkey(name)
    `).eq('sport', sport);

    const select = document.getElementById('admin-match-select');
    select.innerHTML = (matches || []).map(m => `
        <option value="${m.id}" data-sa="${m.score_a}" data-sb="${m.score_b}" data-status="${m.status}" data-mvp="${m.mvp_name || ''}">
            Match #${m.id}: ${m.team_a?.name} vs ${m.team_b?.name} (${m.status})
        </option>
    `).join('');

    select.onchange = function() {
        const opt = this.options[this.selectedIndex];
        document.getElementById('admin-score-a').value = opt.getAttribute('data-sa');
        document.getElementById('admin-score-b').value = opt.getAttribute('data-sb');
        document.getElementById('admin-status').value = opt.getAttribute('data-status');
        document.getElementById('admin-mvp').value = opt.getAttribute('data-mvp');
    };
    if (select.options.length > 0) select.onchange();
}

async function commitAdminUpdate() {
    const matchId = document.getElementById('admin-match-select').value;
    const score_a = parseInt(document.getElementById('admin-score-a').value) || 0;
    const score_b = parseInt(document.getElementById('admin-score-b').value) || 0;
    const status = document.getElementById('admin-status').value;
    const mvp_name = document.getElementById('admin-mvp').value;

    const { error } = await supabaseClient
        .from('matches')
        .update({ score_a, score_b, status, mvp_name })
        .eq('id', matchId);

    if (error) {
        alert("Update failed: " + error.message);
    } else {
        alert("Match updated and published successfully!");
        loadAdminMatchData();
    }
}