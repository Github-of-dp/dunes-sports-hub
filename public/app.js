const SUPABASE_URL = "https://agpxofzartbkgelljmeo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_oxkPdxHk477KlXVJSpxVmA_TGRnrWh1";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentSport = null;
let appData = { teams: [], players: [], matches: [] };
let activeMatchId = null;

// --- PUBLIC PORTAL LOGIC ---
function selectSport(sport) {
    currentSport = sport;
    document.getElementById('sport-selector-view').classList.add('hidden');
    document.getElementById('sport-dashboard-view').classList.remove('hidden');
    document.getElementById('active-sport-title').textContent = sport.toUpperCase();
    
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

    // Setup Supabase Real-Time Listener for instant updates without refresh
    supabaseClient
        .channel('public-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
            if (currentSport) loadSportData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
            if (currentSport) loadSportData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
            if (currentSport) loadSportData();
        })
        .subscribe();
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
        `).eq('sport', currentSport).order('id', { ascending: true });

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
    const liveMatch = appData.matches.find(m => m.status === 'LIVE');
    const container = document.getElementById('live-match-container');
    const badge = document.getElementById('live-badge');

    if (!liveMatch) {
        badge.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-200 text-stone-700 text-xs font-bold";
        badge.innerHTML = `<i class="fa-solid fa-circle-info"></i> No Live Match Currently`;
        container.innerHTML = `
            <div class="col-span-3 py-12 text-center text-stone-400 space-y-2">
                <i class="fa-solid fa-tv text-3xl"></i>
                <p class="text-sm font-semibold">No matches are currently ongoing for ${currentSport.toUpperCase()}. Check schedule for upcoming games.</p>
            </div>
        `;
        document.getElementById('live-venue').textContent = "Main Ground";
        document.getElementById('live-mvp').textContent = "Pending...";
        document.getElementById('live-commentary').textContent = "Awaiting match kickoff...";
        return;
    }

    badge.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold animate-pulse";
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-600"></span> Live Stream Active`;
    document.getElementById('live-venue').textContent = liveMatch.venue || 'Main Ground';
    document.getElementById('live-mvp').textContent = liveMatch.mvp_name || 'Pending...';
    document.getElementById('live-commentary').textContent = liveMatch.commentary || "Match in progress...";

    container.innerHTML = `
        <div><h3 class="text-xl sm:text-2xl font-black text-stone-900 uppercase">${liveMatch.team_a?.name || 'Team A'}</h3><p class="text-xs text-[#8C6D46] font-bold">${liveMatch.team_a?.house || ''}</p></div>
        <div class="flex flex-col items-center justify-center">
            <div class="flex items-baseline gap-3">
                <span class="text-5xl font-black text-[#7A1C2E] font-mono">${liveMatch.score_a}</span>
                <span class="text-2xl font-light text-stone-400">-</span>
                <span class="text-5xl font-black text-stone-900 font-mono">${liveMatch.score_b}</span>
            </div>
            <span class="mt-2 text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 px-3 py-1 rounded-full animate-pulse">ONGOING LIVE</span>
        </div>
        <div><h3 class="text-xl sm:text-2xl font-black text-stone-900 uppercase">${liveMatch.team_b?.name || 'Team B'}</h3><p class="text-xs text-[#8C6D46] font-bold">${liveMatch.team_b?.house || ''}</p></div>
    `;
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
                <span class="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${m.status === 'LIVE' ? 'bg-red-100 text-red-700 animate-pulse' : m.status === 'COMPLETED' ? 'bg-stone-200 text-stone-700' : 'bg-amber-100 text-amber-800'}">${m.status}</span>
            </div>
            <div class="flex justify-between items-center font-bold text-sm text-stone-900">
                <span>${m.team_a?.name || 'Team A'}</span>
                <span class="font-mono text-base text-[#7A1C2E]">${m.score_a} - ${m.score_b}</span>
                <span>${m.team_b?.name || 'Team B'}</span>
            </div>
            <div class="text-[11px] text-stone-500 flex justify-between pt-1 border-t border-stone-200">
                <span><i class="fa-solid fa-star text-amber-500"></i> MVP: ${m.mvp_name || 'N/A'}</span>
                <span>${m.venue || 'Ground'}</span>
            </div>
        </div>
    `).join('');
}

function renderPlayerStatsSection() {
    const sorted = [...appData.players].sort((a, b) => b.stat_primary - a.stat_primary);
    
    document.getElementById('stat-col-1-title').textContent = currentSport === 'football' ? 'Golden Boot (Goals)' : currentSport === 'cricket' ? 'Orange Cap (Runs)' : currentSport === 'volleyball' ? 'Top Spike Points' : 'Top Scorers (Points)';
    document.getElementById('stat-col-1-list').innerHTML = sorted.slice(0, 5).map((p, i) => `
        <div class="flex justify-between items-center p-2 rounded-xl bg-stone-50 border border-stone-200">
            <div><strong class="text-stone-900">#0${i+1} ${p.name}</strong><span class="block text-[10px] text-stone-500">${p.grade}</span></div>
            <span class="font-black text-[#7A1C2E] font-mono text-sm">${p.stat_primary}</span>
        </div>
    `).join('');

    const sortedSec = [...appData.players].sort((a, b) => b.stat_secondary - a.stat_secondary);
    document.getElementById('stat-col-2-title').textContent = currentSport === 'volleyball' ? 'Blocks & Aces' : 'Assists / Wickets';
    document.getElementById('stat-col-2-list').innerHTML = sortedSec.slice(0, 5).map((p, i) => `
        <div class="flex justify-between items-center p-2 rounded-xl bg-stone-50 border border-stone-200">
            <div><strong class="text-stone-900">#0${i+1} ${p.name}</strong><span class="block text-[10px] text-stone-500">${p.grade}</span></div>
            <span class="font-black text-stone-700 font-mono text-sm">${p.stat_secondary}</span>
        </div>
    `).join('');

    document.getElementById('stat-col-3-title').textContent = 'Player Index';
    document.getElementById('stat-col-3-list').innerHTML = sorted.slice(0, 5).map((p, i) => `
        <div class="flex justify-between items-center p-2 rounded-xl bg-stone-50 border border-stone-200">
            <div><strong class="text-stone-900">${p.name}</strong><span class="block text-[10px] text-stone-500">Active Competitor</span></div>
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
                        ${teamPlayers.length ? teamPlayers.map(p => `<div>• ${p.name} (${p.grade})</div>`).join('') : '<span class="italic text-stone-400">No players registered.</span>'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}


// --- ADMIN PORTAL LOGIC ---
let adminSport = 'football';

function verifyAdminPasskey() {
    const passkey = document.getElementById('admin-passkey-input').value;
    if (passkey === "DUNES2026") {
        document.getElementById('admin-auth-card').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        setAdminSport('football');
    } else {
        alert("Incorrect Passkey!");
    }
}

function setAdminSport(sport) {
    adminSport = sport;
    ['football', 'cricket', 'volleyball', 'basketball'].forEach(s => {
        const card = document.getElementById(`scard-${s}`);
        if (s === sport) {
            card.className = "p-4 rounded-2xl border-2 border-[#7A1C2E] bg-[#7A1C2E]/5 cursor-pointer text-center font-bold text-xs uppercase text-[#7A1C2E]";
        } else {
            card.className = "p-4 rounded-2xl border border-stone-200 cursor-pointer text-center font-bold text-xs uppercase transition hover:border-[#7A1C2E]";
        }
    });
    loadAdminContext();
}

function switchAdminTab(tab) {
    ['data', 'schedule', 'players'].forEach(t => {
        const sec = document.getElementById(`admin-section-${t}`);
        const btn = document.getElementById(`admin-tab-${t}`);
        if (t === tab) {
            sec.classList.remove('hidden');
            btn.className = "flex-1 py-3 rounded-xl font-bold text-xs bg-[#7A1C2E] text-white transition";
        } else {
            sec.classList.add('hidden');
            btn.className = "flex-1 py-3 rounded-xl font-semibold text-xs bg-stone-100 text-stone-700 hover:bg-stone-200 transition";
        }
    });
    loadAdminContext();
}

async function loadAdminContext() {
    const { data: matches } = await supabaseClient.from('matches').select(`
        *, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name)
    `).eq('sport', adminSport).order('id', { ascending: true });

    const { data: teams } = await supabaseClient.from('teams').select('*').eq('sport', adminSport);
    const { data: players } = await supabaseClient.from('players').select('*').eq('sport', adminSport);

    appData = { teams: teams || [], players: players || [], matches: matches || [] };

    // Render Admin Match Cards Grid
    const grid = document.getElementById('admin-matches-cards-grid');
    grid.innerHTML = (matches || []).map(m => `
        <div onclick="selectActiveAdminMatch(${m.id})" class="p-4 rounded-2xl border-2 cursor-pointer transition ${activeMatchId === m.id ? 'border-[#7A1C2E] bg-[#7A1C2E]/5' : 'border-stone-200 hover:border-stone-400'}">
            <div class="flex justify-between items-center text-xs mb-1">
                <span class="font-bold text-[#7A1C2E]">Match #${m.id}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.status === 'LIVE' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-stone-200 text-stone-700'}">${m.status}</span>
            </div>
            <div class="font-bold text-sm text-stone-900">${m.team_a?.name} vs ${m.team_b?.name}</div>
            <div class="text-xs font-mono text-stone-600 mt-1">Score: ${m.score_a} - ${m.score_b}</div>
        </div>
    `).join('');

    // Populate Schedule Manager
    const optHtml = teams.map(t => `<option value="${t.id}">${t.name} (${t.house})</option>`).join('');
    document.getElementById('sched-team-a').innerHTML = optHtml;
    document.getElementById('sched-team-b').innerHTML = optHtml;
    document.getElementById('player-team-select').innerHTML = optHtml;

    document.getElementById('existing-fixtures-cards').innerHTML = matches.map(m => `
        <div onclick="editFixtureModal(${m.id})" class="p-3 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer hover:border-[#7A1C2E]">
            <div class="text-xs font-bold text-stone-900">Match #${m.id}: ${m.team_a?.name} vs ${m.team_b?.name}</div>
            <div class="text-[10px] text-stone-500">Venue: ${m.venue} | Status: ${m.status}</div>
        </div>
    `).join('');

    // Populate Player Manager List
    document.getElementById('admin-players-list').innerHTML = players.map(p => {
        const tObj = teams.find(t => t.id === p.team_id);
        return `
            <div class="flex justify-between items-center p-2 rounded-xl bg-stone-50 border border-stone-200">
                <span>${p.name} (${p.grade}) - <strong class="text-[#7A1C2E]">${tObj?.name || 'Team'}</strong></span>
                <button onclick="removePlayer(${p.id})" class="text-rose-600 font-bold hover:underline">Remove</button>
            </div>
        `;
    }).join('');

    if (activeMatchId) selectActiveAdminMatch(activeMatchId);
}

function selectActiveAdminMatch(id) {
    activeMatchId = id;
    const match = appData.matches.find(m => m.id === id);
    if (!match) return;

    document.getElementById('active-match-control-box').classList.remove('hidden');
    document.getElementById('active-match-title').textContent = `Match #${match.id}: ${match.team_a?.name} vs ${match.team_b?.name}`;
    document.getElementById('active-match-status-label').textContent = `Status: ${match.status}`;
    document.getElementById('team-a-label').textContent = match.team_a?.name || 'Team A';
    document.getElementById('team-b-label').textContent = match.team_b?.name || 'Team B';
    document.getElementById('disp-score-a').textContent = match.score_a;
    document.getElementById('disp-score-b').textContent = match.score_b;
    document.getElementById('admin-mvp-input').value = match.mvp_name || '';

    const scoringWrapper = document.getElementById('match-scoring-wrapper');
    if (match.status === 'COMPLETED') {
        scoringWrapper.style.opacity = "0.5";
        scoringWrapper.style.pointerEvents = "none";
    } else {
        scoringWrapper.style.opacity = "1";
        scoringWrapper.style.pointerEvents = "auto";
    }

    const playersA = appData.players.filter(p => p.team_id === match.team_a_id);
    const playersB = appData.players.filter(p => p.team_id === match.team_b_id);

    document.getElementById('team-a-players-list').innerHTML = playersA.map(p => `
        <div class="flex flex-col gap-1 bg-white p-2 rounded-lg border border-stone-200">
            <div class="flex justify-between items-center text-xs">
                <span class="font-bold">${p.name}</span>
                <button onclick="creditPlayerPoint(${match.id}, 'A', ${p.id}, '${p.name}')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px]">+1 Pt</button>
            </div>
            <div class="flex gap-1 text-[10px]">
                <button onclick="incrementPlayerSecondary(${p.id}, 'block')" class="px-2 py-0.5 bg-stone-200 hover:bg-stone-300 rounded font-semibold">+ Block</button>
                <button onclick="incrementPlayerSecondary(${p.id}, 'ace')" class="px-2 py-0.5 bg-stone-200 hover:bg-stone-300 rounded font-semibold">+ Ace</button>
                <span class="ml-auto text-stone-500 font-mono">Blk:${p.stat_secondary || 0}</span>
            </div>
        </div>
    `).join('') || '<span class="italic text-stone-400">No players in roster.</span>';

    document.getElementById('team-b-players-list').innerHTML = playersB.map(p => `
        <div class="flex flex-col gap-1 bg-white p-2 rounded-lg border border-stone-200">
            <div class="flex justify-between items-center text-xs">
                <span class="font-bold">${p.name}</span>
                <button onclick="creditPlayerPoint(${match.id}, 'B', ${p.id}, '${p.name}')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px]">+1 Pt</button>
            </div>
            <div class="flex gap-1 text-[10px]">
                <button onclick="incrementPlayerSecondary(${p.id}, 'block')" class="px-2 py-0.5 bg-stone-200 hover:bg-stone-300 rounded font-semibold">+ Block</button>
                <button onclick="incrementPlayerSecondary(${p.id}, 'ace')" class="px-2 py-0.5 bg-stone-200 hover:bg-stone-300 rounded font-semibold">+ Ace</button>
                <span class="ml-auto text-stone-500 font-mono">Blk:${p.stat_secondary || 0}</span>
            </div>
        </div>
    `).join('') || '<span class="italic text-stone-400">No players in roster.</span>';
}

async function adminStartMatch() {
    if (!activeMatchId) return;
    await supabaseClient.from('matches').update({ status: 'LIVE' }).eq('id', activeMatchId);
    loadAdminContext();
}

async function adminEndMatch() {
    if (!activeMatchId) return;
    const match = appData.matches.find(m => m.id === activeMatchId);
    if (!match) return;

    await supabaseClient.from('matches').update({ status: 'COMPLETED' }).eq('id', activeMatchId);

    if (match.score_a !== match.score_b) {
        const winnerId = match.score_a > match.score_b ? match.team_a_id : match.team_b_id;
        const loserId = match.score_a > match.score_b ? match.team_b_id : match.team_a_id;

        const { data: winTeam } = await supabaseClient.from('teams').select('*').eq('id', winnerId).single();
        await supabaseClient.from('teams').update({
            played: winTeam.played + 1, won: winTeam.won + 1, points: winTeam.points + 3,
            extra_metric: winTeam.extra_metric + Math.abs(match.score_a - match.score_b)
        }).eq('id', winnerId);

        const { data: loseTeam } = await supabaseClient.from('teams').select('*').eq('id', loserId).single();
        await supabaseClient.from('teams').update({
            played: loseTeam.played + 1, lost: loseTeam.lost + 1,
            extra_metric: loseTeam.extra_metric - Math.abs(match.score_a - match.score_b)
        }).eq('id', loserId);
    }

    alert("Match concluded & standings calculated!");
    loadAdminContext();
}

async function modifyScore(teamLetter, delta) {
    if (!activeMatchId) return;
    const match = appData.matches.find(m => m.id === activeMatchId);
    let sa = match.score_a;
    let sb = match.score_b;
    if (teamLetter === 'A') sa = Math.max(0, sa + delta);
    if (teamLetter === 'B') sb = Math.max(0, sb + delta);

    await supabaseClient.from('matches').update({ score_a: sa, score_b: sb }).eq('id', activeMatchId);
    loadAdminContext();
}

async function creditPlayerPoint(matchId, teamLetter, playerId, playerName) {
    const match = appData.matches.find(m => m.id === matchId);
    let sa = match.score_a;
    let sb = match.score_b;
    if (teamLetter === 'A') sa += 1;
    if (teamLetter === 'B') sb += 1;

    const commentaryText = `Point scored by ${playerName} (${teamLetter === 'A' ? match.team_a?.name : match.team_b?.name})`;

    // Optimized single-transaction update
    await supabaseClient.from('matches').update({
        score_a: sa, score_b: sb, commentary: commentaryText
    }).eq('id', matchId);

    const { data: player } = await supabaseClient.from('players').select('*').eq('id', playerId).single();
    if (player) {
        await supabaseClient.from('players').update({ stat_primary: player.stat_primary + 1 }).eq('id', playerId);
    }

    loadAdminContext();
}

async function incrementPlayerSecondary(playerId, type) {
    const { data: player } = await supabaseClient.from('players').select('*').eq('id', playerId).single();
    if (player) {
        await supabaseClient.from('players').update({ stat_secondary: (player.stat_secondary || 0) + 1 }).eq('id', playerId);
        loadAdminContext();
    }
}

async function saveMvp() {
    if (!activeMatchId) return;
    const mvp = document.getElementById('admin-mvp-input').value;
    await supabaseClient.from('matches').update({ mvp_name: mvp }).eq('id', activeMatchId);
    alert("MVP saved!");
    loadAdminContext();
}

async function createNewFixture() {
    const team_a_id = document.getElementById('sched-team-a').value;
    const team_b_id = document.getElementById('sched-team-b').value;
    const venue = document.getElementById('sched-venue').value;

    if (team_a_id === team_b_id) { alert("Team A and Team B cannot be identical."); return; }

    await supabaseClient.from('matches').insert([{
        sport: adminSport, team_a_id, team_b_id, venue, status: 'UPCOMING', score_a: 0, score_b: 0
    }]);
    alert("Fixture created successfully!");
    loadAdminContext();
}

async function addNewPlayer() {
    const team_id = document.getElementById('player-team-select').value;
    const name = document.getElementById('new-player-name').value;
    const grade = document.getElementById('new-player-grade').value;

    if (!name) { alert("Enter player name."); return; }

    await supabaseClient.from('players').insert([{
        sport: adminSport, team_id, name, grade, stat_primary: 0, stat_secondary: 0
    }]);
    alert("Player registered successfully!");
    document.getElementById('new-player-name').value = '';
    loadAdminContext();
}

async function removePlayer(id) {
    if (!confirm("Remove this player?")) return;
    await supabaseClient.from('players').delete().eq('id', id);
    loadAdminContext();
}