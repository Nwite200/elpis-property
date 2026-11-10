// Team Lead — manage the marketers in the team(s) they lead.
(function () {
  const S = window.elpisStaff;
  const el = id => document.getElementById(id);
  let me = null;
  let teams = [];
  let current = null;

  function showMessage(text, tone) {
    const node = el("teamMsg");
    node.textContent = text || "";
    node.style.color = tone === "error" ? "#a3352b" : "var(--brand-primary)";
  }

  async function loadTeams() {
    const data = await S.fetchJson("/api/teams?mine=1");
    teams = data.teams || [];
    const select = el("teamSelect");
    select.innerHTML = "";
    teams.forEach(team => {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = `${team.name} · ${team.branch_name || ""} · ${team.member_count || 0} member(s)`;
      select.appendChild(option);
    });
    if (!teams.length) {
      el("teamBody").innerHTML = '<tr><td colspan="3" class="empty-state">You have not been assigned a team yet. Ask your branch manager to assign one.</td></tr>';
      el("addMemberBtn").disabled = true;
      return;
    }
    await loadMembers(teams[0].id);
  }

  async function loadMembers(teamId) {
    const data = await S.fetchJson(`/api/teams/${teamId}/members`);
    current = data.team;
    el("teamTitle").textContent = current.name;
    el("teamMeta").textContent = `${current.branch_name || ""} · Team lead: ${current.team_lead_name || "—"}`;
    const body = el("teamBody");
    body.innerHTML = "";
    if (!data.members.length) {
      body.innerHTML = '<tr><td colspan="3" class="empty-state">No marketers in this team yet.</td></tr>';
    } else {
      for (const member of data.members) {
        const row = document.createElement("tr");
        row.innerHTML = `<td><strong>${S.escape(member.full_name)}</strong><div class="small muted">${S.escape(member.email || "")}</div></td>
          <td>${S.escape(member.role_name || "")}</td>
          <td style="text-align:right"></td>`;
        if (me && me.role === "Team Lead") {
          const remove = document.createElement("button");
          remove.className = "btn btn-outline";
          remove.type = "button";
          remove.textContent = "Remove";
          remove.addEventListener("click", () => removeMember(member));
          row.lastElementChild.appendChild(remove);
        }
        body.appendChild(row);
      }
    }
    const select = el("memberSelect");
    select.innerHTML = "";
    for (const candidate of data.candidates || []) {
      const option = document.createElement("option");
      option.value = candidate.id;
      option.textContent = `${candidate.full_name} · ${candidate.email || ""}`;
      select.appendChild(option);
    }
    el("addMemberBtn").disabled = !(data.candidates || []).length || !me || me.role !== "Team Lead";
    el("addWrap").style.display = me && me.role === "Team Lead" ? "flex" : "none";
    if (!(data.candidates || []).length) {
      select.innerHTML = '<option value="">No eligible marketers available</option>';
    }
  }

  async function addMember() {
    const userId = Number(el("memberSelect").value);
    if (!userId || !current) return;
    el("addMemberBtn").disabled = true;
    try {
      await S.fetchJson(`/api/teams/${current.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });
      showMessage("Marketer added to your team.");
      await loadTeams();
    } catch (error) {
      showMessage(error.message, "error");
      el("addMemberBtn").disabled = false;
    }
  }

  async function removeMember(member) {
    if (!current) return;
    try {
      await S.fetchJson(`/api/teams/${current.id}/members/${member.id}`, { method: "DELETE" });
      showMessage(`${member.full_name} removed from the team.`);
      await loadTeams();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  window.addEventListener("DOMContentLoaded", async () => {
    try {
      me = await S.initShell("my-team");
      if (!me) return;
      if (!["Team Lead", "Marketer", "Managing Director", "Branch Manager"].includes(me.role)) {
        el("teamBody").innerHTML = '<tr><td colspan="3" class="empty-state">You do not have team access.</td></tr>';
        return;
      }
      el("memberSelect").addEventListener("change", () => showMessage(""));
      el("addMemberBtn").addEventListener("click", addMember);
      el("teamSelect").addEventListener("change", event => loadMembers(Number(event.target.value)));
      await loadTeams();
    } catch (error) {
      showMessage(error.message, "error");
    }
  });
})();
