const KEY_EXPORT = 'ccuTree_hangarJson';
const KEY_LEGEND_COLLAPSED = 'ccuTree_legendCollapsed';
const FONT_VIS = 'DM Sans';

const viewDefaults = {
    showOwnedOnly: true,
    showUpgrades: true,
    showShips: true,
    showBuyback: true,
    hideRedundantCcu: false
};

let hangarData = null;
let network = null;
let nodes = new Map();
let edges = new Map();
let excludedItems = new Set();
let customItems = [];
let viewOptions = { ...viewDefaults };

function EdgeKeyCustom() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `custom_${crypto.randomUUID()}`;
    return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function PullStorage() {
    try {
        const ex = localStorage.getItem('ccuTree_excludedItems');
        if (ex) excludedItems = new Set(JSON.parse(ex));

        const rawCustom = localStorage.getItem('ccuTree_customItems');
        if (rawCustom) {
            customItems = JSON.parse(rawCustom);
            let dirty = false;
            customItems.forEach(row => {
                if (row.type === 'upgrade' && !row.id) {
                    row.id = EdgeKeyCustom();
                    dirty = true;
                }
            });
            if (dirty) localStorage.setItem('ccuTree_customItems', JSON.stringify(customItems));
        }

        const vo = localStorage.getItem('ccuTree_viewOptions');
        if (vo) viewOptions = { ...viewDefaults, ...JSON.parse(vo) };
    } catch (err) {
        console.warn(err);
    }
}

function PushStorage() {
    try {
        localStorage.setItem('ccuTree_excludedItems', JSON.stringify([...excludedItems]));
        localStorage.setItem('ccuTree_customItems', JSON.stringify(customItems));
        localStorage.setItem('ccuTree_viewOptions', JSON.stringify(viewOptions));
    } catch (err) {
        console.warn(err);
    }
}

function StashHangarJson(txt) {
    try {
        localStorage.setItem(KEY_EXPORT, txt);
    } catch (err) {
        console.warn(err);
    }
}

const HANGAR_LINK_CHROME_EXT =
    'https://chromewebstore.google.com/detail/hangar-link-connect/faogejfedelmehbgclhooomkocdbdoig';
const HANGAR_LINK_FIREFOX_EXT =
    'https://addons.mozilla.org/en-US/firefox/addon/hangar-link-connect/';

function HangarLinkExtensionKind() {
    const ua = navigator.userAgent;
    if (/Firefox\//.test(ua)) return 'firefox';
    if (/Edg\//.test(ua) || /OPR\//.test(ua) || /Chrome\//.test(ua) || /CriOS\//.test(ua)) return 'chromium';
    return 'other';
}

function WireGraphLegendToggle() {
    const aside = document.getElementById('graphLegend');
    const btn = document.getElementById('graphLegendToggle');
    if (!aside || !btn) return;

    function ApplyLegendCollapsed(collapsed) {
        aside.classList.toggle('collapsed', collapsed);
        btn.setAttribute('aria-expanded', String(!collapsed));
        const label = collapsed ? 'Expand legend' : 'Collapse legend';
        btn.title = label;
        btn.setAttribute('aria-label', label);
    }

    try {
        ApplyLegendCollapsed(localStorage.getItem(KEY_LEGEND_COLLAPSED) === '1');
    } catch (_) {
        ApplyLegendCollapsed(false);
    }

    btn.addEventListener('click', () => {
        const collapsed = !aside.classList.contains('collapsed');
        ApplyLegendCollapsed(collapsed);
        try {
            localStorage.setItem(KEY_LEGEND_COLLAPSED, collapsed ? '1' : '0');
        } catch (_) {}
    });
}

function WireHangarLinkCta() {
    const root = document.getElementById('hangarLinkStores');
    if (!root) return;
    const kind = HangarLinkExtensionKind();
    const link = (href, label) =>
        `<a class="hangar-link-btn" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    if (kind === 'firefox') {
        root.innerHTML = link(HANGAR_LINK_FIREFOX_EXT, 'Install extension — Firefox');
    } else if (kind === 'chromium') {
        root.innerHTML = link(HANGAR_LINK_CHROME_EXT, 'Install extension — Chrome / Edge');
    } else {
        root.innerHTML =
            link(HANGAR_LINK_CHROME_EXT, 'Chrome Web Store') + link(HANGAR_LINK_FIREFOX_EXT, 'Firefox Add-ons');
    }
}

function insTag(t) {
    if (!t || t === 'insNone') return '';

    const fixed = {
        insLTI: '∞',
        ins6: '6M',
        ins12: '12M',
        ins24: '24M',
        ins36: '36M',
        ins48: '48M',
        ins60: '60M',
        ins72: '72M',
        ins84: '84M',
        ins96: '96M',
        ins108: '108M',
        ins120: '120M'
    };

    if (t.startsWith('ins')) {
        const rest = t.replace('ins', '');
        if (rest === 'LTI') return '∞';
        if (rest && !isNaN(rest)) return `${rest}M`;
        if (fixed[t]) return fixed[t];
    }
    return t.replace('ins', '');
}

document.addEventListener('DOMContentLoaded', () => {
    WireHangarLinkCta();
    if (typeof feather !== 'undefined') {
        feather.replace({ width: 20, height: 20, 'stroke-width': 1.85, class: 'graph-toolbar-icon' });
    }
    WireGraphLegendToggle();
    PullStorage();

    let tries = 0;
    const WaitVis = () => {
        if (typeof vis !== 'undefined' && vis.Network) {
            WireUi();
            CheckboxesFromPrefs();
            BootCachedJson();
            return;
        }
        tries++;
        if (tries >= 50) {
            const el = document.getElementById('networkContainer');
            if (el) {
                el.innerHTML =
                    '<div class="init-error">Could not load the graph library (vis-network). Check your network or ad blockers, then refresh.</div>';
            }
            return;
        }
        setTimeout(WaitVis, 100);
    };
    WaitVis();
});

function CheckboxesFromPrefs() {
    let el = document.getElementById('showOwnedOnly');
    if (el) el.checked = viewOptions.showOwnedOnly;
    el = document.getElementById('showUpgrades');
    if (el) el.checked = viewOptions.showUpgrades;
    el = document.getElementById('showShips');
    if (el) el.checked = viewOptions.showShips;
    el = document.getElementById('showBuyback');
    if (el) el.checked = viewOptions.showBuyback !== false;
    el = document.getElementById('hideRedundantCcu');
    if (el) el.checked = !!viewOptions.hideRedundantCcu;
}

const LABEL_PICK = 'Choose hangarlink.json';
const LABEL_SWAP = 'Replace hangar export…';

function SetPickLabel(hasData) {
    const lb = document.getElementById('uploadButtonLabel');
    if (lb) lb.textContent = hasData ? LABEL_SWAP : LABEL_PICK;
}

function ShowFileBanner(msg) {
    const el = document.getElementById('fileStatus');
    if (el) {
        el.textContent = msg;
        el.classList.remove('hidden');
    }
    SetPickLabel(true);
}

function HideFileBanner() {
    const el = document.getElementById('fileStatus');
    if (el) {
        el.textContent = '';
        el.classList.add('hidden');
    }
    SetPickLabel(false);
}

function BootCachedJson() {
    const raw = localStorage.getItem(KEY_EXPORT);
    if (raw) {
        try {
            hangarData = JSON.parse(raw);
            ShowFileBanner(`Restored ${hangarData.pledges?.length || 0} pledges from last session.`);
        } catch (err) {
            console.error(err);
            hangarData = null;
            HideFileBanner();
        }
    } else HideFileBanner();

    IngestPledges();
    RenderExcludes();
    DrawVis();
}

function LoadJson(txt) {
    hangarData = JSON.parse(txt);
    StashHangarJson(txt);
    ShowFileBanner(`Loaded ${hangarData.pledges?.length || 0} pledges (saved in this browser for next visit).`);
    IngestPledges();
    RenderExcludes();
    DrawVis();
}

function FitGraph() {
    if (!network) return;
    network.fit({ padding: 52, animation: { duration: 280, easingFunction: 'easeInOutQuad' } });
    requestAnimationFrame(() => PlaceInsBadges());
    setTimeout(() => PlaceInsBadges(), 320);
}

function BumpZoom(mul) {
    if (!network) return;
    const s = Math.min(2, Math.max(0.2, network.getScale() * mul));
    network.moveTo({ scale: s, animation: { duration: 140, easingFunction: 'easeInOutQuad' } });
    setTimeout(() => PlaceInsBadges(), 160);
}

function MergeCustomEdges() {
    customItems.forEach((row, i) => {
        if (row.type === 'upgrade') {
            const a = displayName(row.from) || row.from;
            const b = displayName(row.to) || row.to;
            AddNode(row.from, a, false, null);
            AddNode(row.to, b, false, null);
            const id = row.id || `custom_legacy_${row.from}_${row.to}_${i}`;
            edges.set(id, {
                id,
                from: row.from,
                to: row.to,
                owned: false,
                upgrade: { name: row.name, cost: '0' },
                label: row.name,
                color: { color: '#ff6b6b' },
                isCustom: true
            });
        } else AddNode(row.to, row.name, false, null);
    });
}

function WireUi() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');

    fileInput.addEventListener('change', OnFileChosen);

    uploadArea.addEventListener('click', e => {
        if (e.target === uploadArea || e.target.classList.contains('upload-hint')) fileInput.click();
    });

    uploadArea.addEventListener('dragover', e => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', e => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const f = e.dataTransfer.files[0];
        if (f && f.name.toLowerCase().endsWith('.json')) {
            const r = new FileReader();
            r.onload = ev => {
                try {
                    LoadJson(ev.target.result);
                } catch (err) {
                    alert('Error parsing JSON file: ' + err.message);
                    console.error(err);
                }
            };
            r.readAsText(f);
        }
    });

    document.getElementById('excludeSearch').addEventListener('input', e => FilterExcludes(e.target.value));

    document.getElementById('addItemType').addEventListener('change', e => {
        const from = document.getElementById('addItemFrom');
        from.disabled = e.target.value === 'ship';
        if (e.target.value === 'ship') from.value = '';
    });

    document.getElementById('addItemBtn').addEventListener('click', AddScratchItem);

    document.getElementById('showOwnedOnly').addEventListener('change', e => {
        viewOptions.showOwnedOnly = e.target.checked;
        PushStorage();
        DrawVis();
    });
    document.getElementById('showUpgrades').addEventListener('change', e => {
        viewOptions.showUpgrades = e.target.checked;
        PushStorage();
        DrawVis();
    });
    document.getElementById('showShips').addEventListener('change', e => {
        viewOptions.showShips = e.target.checked;
        PushStorage();
        DrawVis();
    });

    document.getElementById('showBuyback').addEventListener('change', e => {
        viewOptions.showBuyback = e.target.checked;
        PushStorage();
        IngestPledges();
        RenderExcludes();
        DrawVis();
    });

    document.getElementById('hideRedundantCcu').addEventListener('change', e => {
        viewOptions.hideRedundantCcu = e.target.checked;
        PushStorage();
        IngestPledges();
        RenderExcludes();
        DrawVis();
    });

    const fitBtn = document.getElementById('btnFitView');
    if (fitBtn) fitBtn.addEventListener('click', () => FitGraph());
    const zIn = document.getElementById('btnZoomIn');
    if (zIn) zIn.addEventListener('click', () => BumpZoom(1.2));
    const zOut = document.getElementById('btnZoomOut');
    if (zOut) zOut.addEventListener('click', () => BumpZoom(1 / 1.2));
}

function OnFileChosen(ev) {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = e => {
        try {
            LoadJson(e.target.result);
        } catch (err) {
            alert('Error parsing JSON file: ' + err.message);
            console.error(err);
        }
    };
    r.readAsText(f);
}

function buybackSuppressed(p) {
    return p.buyback && !viewOptions.showBuyback;
}

function IngestPledges() {
    nodes.clear();
    edges.clear();

    if (!hangarData?.pledges) {
        MergeCustomEdges();
        return;
    }

    const fullShips = new Set();
    hangarData.pledges.forEach(p => {
        if (buybackSuppressed(p)) return;
        if (p.pledgeType !== 'ship') return;
        p.items?.forEach(it => {
            if (it.kind === 'Ship' && it.slug) {
                AddNode(it.slug, it.title, true, p);
                if (!p.buyback) fullShips.add(it.slug);
            }
        });
    });

    hangarData.pledges.forEach(p => {
        if (buybackSuppressed(p)) return;
        if (p.pledgeType !== 'upgrade' || !p.upgradeFrom || !p.upgradeTo) return;

        const redundantTarget = fullShips.has(p.upgradeTo);
        if (viewOptions.hideRedundantCcu && redundantTarget) return;

        AddNode(p.upgradeFrom, displayName(p.upgradeFrom), true, null);
        AddNode(p.upgradeTo, displayName(p.upgradeTo), true, p);

        const eid = p.pledgeId ? `pledge_${p.pledgeId}` : `upgrade_${p.upgradeFrom}_${p.upgradeTo}_${edges.size}`;
        const col = p.buyback
            ? { color: '#666' }
            : redundantTarget
              ? { color: '#e6a23c' }
              : { color: '#4a9eff' };
        edges.set(eid, {
            id: eid,
            from: p.upgradeFrom,
            to: p.upgradeTo,
            owned: !p.buyback,
            isBuyback: !!p.buyback,
            upgrade: p,
            toOwnedFullHull: redundantTarget,
            label: `$${p.cost || '0'}`,
            color: col
        });
    });

    MergeCustomEdges();
}

function displayName(slug) {
    if (!hangarData?.pledges) return slugAsWords(slug);

    for (const p of hangarData.pledges) {
        if (!p.items) continue;
        for (const it of p.items) {
            if (it.slug === slug && it.kind === 'Ship') return it.title;
        }
    }

    for (const p of hangarData.pledges) {
        if (p.pledgeType !== 'upgrade') continue;
        const n = p.name || '';
        if (p.upgradeFrom === slug) {
            const m = n.match(/Upgrade - (.+?)\s+to/i);
            if (m) return m[1].trim();
        }
        if (p.upgradeTo === slug) {
            let m = n.match(/to\s+(.+?)(?:\s+(?:Standard|Warbond|CCU|Edition)|\s*\(|$)/i);
            if (!m) m = n.match(/to\s+(.+)/i);
            if (m) return m[1].trim();
        }
    }

    return slugAsWords(slug);
}

function slugAsWords(slug) {
    return slug
        .split('-')
        .map(w => (w === 'mk' || w === 'ii' || w === 'iii' ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ');
}

function AddNode(slug, name, owned, pledge = null) {
    const ins = pledge ? pledge.insuranceType : null;
    if (!nodes.has(slug)) {
        nodes.set(slug, {
            id: slug,
            label: name,
            owned,
            slug,
            pledge,
            isFullShip: pledge && pledge.pledgeType === 'ship',
            insuranceType: ins
        });
    } else {
        const n = nodes.get(slug);
        if (owned) n.owned = true;
        if (pledge && !n.pledge) {
            n.pledge = pledge;
            n.isFullShip = pledge.pledgeType === 'ship';
            n.insuranceType = pledge.insuranceType;
        } else if (pledge?.pledgeType === 'ship') {
            n.isFullShip = true;
            if (pledge.insuranceType) n.insuranceType = pledge.insuranceType;
        }
    }
}

function oldPairId(edge) {
    return `${edge.from}-${edge.to}`;
}

function isMasked(edge) {
    if (!edge) return false;
    if (edge.id && excludedItems.has(edge.id)) return true;
    return excludedItems.has(oldPairId(edge));
}

function RenderExcludes() {
    const list = document.getElementById('excludeList');
    list.innerHTML = '';

    const ships = [...nodes.values()].map(n => ({
        key: n.slug,
        label: n.label,
        checked: () => excludedItems.has(n.slug),
        on(checked) {
            if (checked) excludedItems.add(n.slug);
            else excludedItems.delete(n.slug);
        }
    }));

    const ups = [...edges.values()].map(e => ({
        key: e.id,
        label: `${displayName(e.from)} → ${displayName(e.to)} (${e.label})`,
        checked: () => excludedItems.has(e.id) || excludedItems.has(oldPairId(e)),
        on(checked) {
            if (checked) excludedItems.add(e.id);
            else {
                excludedItems.delete(e.id);
                excludedItems.delete(oldPairId(e));
            }
        }
    }));

    [...ships, ...ups].forEach((row, i) => {
        const id = `exclude-${i}-${String(row.key).replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 180);
        const wrap = document.createElement('div');
        wrap.className = 'exclude-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = id;
        cb.checked = row.checked();
        cb.addEventListener('change', ev => {
            row.on(ev.target.checked);
            PushStorage();
            DrawVis();
        });
        const lab = document.createElement('label');
        lab.htmlFor = id;
        lab.textContent = row.label;
        lab.prepend(cb);
        wrap.appendChild(lab);
        list.appendChild(wrap);
    });
}

function FilterExcludes(q) {
    const needle = q.toLowerCase();
    document.querySelectorAll('.exclude-item').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(needle) ? 'flex' : 'none';
    });
}

function AddScratchItem() {
    const kind = document.getElementById('addItemType').value;
    const from = document.getElementById('addItemFrom').value.trim();
    const to = document.getElementById('addItemTo').value.trim();
    const name = document.getElementById('addItemName').value.trim();

    if (!to || !name) {
        alert('Please fill in "To" and "Name" fields');
        return;
    }
    if (kind === 'upgrade' && !from) {
        alert('Please fill in "From" field for upgrades');
        return;
    }

    if (kind === 'upgrade') {
        AddNode(from, displayName(from) || from, false, null);
        AddNode(to, displayName(to) || to, false, null);
        const id = EdgeKeyCustom();
        edges.set(id, {
            id,
            from,
            to,
            owned: false,
            upgrade: { name, cost: '0' },
            label: name,
            color: { color: '#ff6b6b' },
            isCustom: true
        });
        customItems.push({ type: 'upgrade', id, from, to, name });
    } else {
        AddNode(to, name, false, null);
        customItems.push({ type: 'ship', to, name });
    }

    document.getElementById('addItemTo').value = '';
    document.getElementById('addItemName').value = '';
    if (kind === 'upgrade') document.getElementById('addItemFrom').value = '';

    PushStorage();
    RenderExcludes();
    DrawVis();
}

function nodeStyle(n) {
    if (n.isFullShip) {
        return {
            background: '#4caf50',
            border: '#66bb6a',
            highlight: { background: '#66bb6a', border: '#81c784' }
        };
    }
    if (n.owned) {
        return {
            background: '#4a9eff',
            border: '#7b68ee',
            highlight: { background: '#5aaeff', border: '#8b78ff' }
        };
    }
    return {
        background: '#ff6b6b',
        border: '#ff5252',
        highlight: { background: '#ff7b7b', border: '#ff6262' }
    };
}

function DrawVis() {
    if (typeof vis === 'undefined') {
        console.error('vis missing');
        return;
    }

    const box = document.getElementById('networkContainer');
    box.innerHTML = '';

    const visNodes = [...nodes.values()]
        .filter(n => {
            if (excludedItems.has(n.slug)) return false;
            if (viewOptions.showOwnedOnly && !n.owned) return false;
            return viewOptions.showShips;
        })
        .map(n => {
            const tag = insTag(n.insuranceType);
            return {
                id: n.id,
                label: n.label,
                color: nodeStyle(n),
                shape: 'box',
                font: { color: '#fff', size: 16, face: FONT_VIS },
                margin: 12,
                widthConstraint: { maximum: 220 },
                title: tag ? `${n.label} - Insurance: ${tag === '∞' ? 'Lifetime' : tag}` : n.label
            };
        });

    const visEdges = [...edges.values()]
        .filter(e => {
            if (isMasked(e)) return false;
            if (excludedItems.has(e.from) || excludedItems.has(e.to)) return false;
            if (!viewOptions.showUpgrades) return false;
            const bbOk = viewOptions.showBuyback !== false && (e.isBuyback || e.upgrade?.buyback);
            if (viewOptions.showOwnedOnly && !e.owned && !bbOk) return false;
            return true;
        })
        .map(e => {
            const intoOwned = e.toOwnedFullHull;
            const bb = e.upgrade?.buyback;
            let tip;
            if (intoOwned) {
                tip = 'CCU into a hull you already own (full ship). Separate from your standalone pledge; still valid inventory.';
            } else if (bb) tip = 'Buyback pledge (inactive hangar slot until reclaimed).';
            return {
                id: e.id,
                from: e.from,
                to: e.to,
                label: intoOwned ? `${e.label} → owned` : e.label,
                title: tip,
                color: e.color,
                dashes: intoOwned ? [8, 6] : false,
                arrows: 'to',
                smooth: { type: 'curvedCW', roundness: 0.2 },
                font: { color: '#fff', size: 12, align: 'middle', face: FONT_VIS }
            };
        });

    const have = new Set(visNodes.map(n => n.id));
    visEdges.forEach(e => {
        if (!have.has(e.from)) {
            const nm = displayName(e.from);
            const ref = nodes.get(e.from);
            const tag = ref ? insTag(ref.insuranceType) : '';
            visNodes.push({
                id: e.from,
                label: nm,
                color: nodeStyle({ isFullShip: ref?.isFullShip, owned: ref?.isFullShip || ref?.owned }),
                shape: 'box',
                font: { color: '#fff', size: 16, face: FONT_VIS },
                margin: 12,
                widthConstraint: { maximum: 220 },
                title: tag ? `${nm} - Insurance: ${tag === '∞' ? 'Lifetime' : tag}` : nm
            });
            have.add(e.from);
        }
        if (!have.has(e.to)) {
            const nm = displayName(e.to);
            const ref = nodes.get(e.to);
            const tag = ref ? insTag(ref.insuranceType) : '';
            visNodes.push({
                id: e.to,
                label: nm,
                color: nodeStyle({ isFullShip: ref?.isFullShip, owned: ref?.isFullShip || ref?.owned }),
                shape: 'box',
                font: { color: '#fff', size: 16, face: FONT_VIS },
                margin: 12,
                widthConstraint: { maximum: 220 },
                title: tag ? `${nm} - Insurance: ${tag === '∞' ? 'Lifetime' : tag}` : nm
            });
            have.add(e.to);
        }
    });

    if (visNodes.length === 0) {
        box.innerHTML =
            '<div class="empty-graph-message"><strong>No graph to show yet.</strong><br>Upload <code>hangarlink.json</code> or add a custom ship/CCU below. After data loads, use <strong>Fit view</strong> so labels stay readable.</div>';
        network = null;
        return;
    }

    network = new vis.Network(
        box,
        { nodes: new vis.DataSet(visNodes), edges: new vis.DataSet(visEdges) },
        {
            layout: {
                hierarchical: {
                    enabled: true,
                    direction: 'LR',
                    sortMethod: 'directed',
                    levelSeparation: 280,
                    nodeSpacing: 72,
                    treeSpacing: 220,
                    blockShifting: true,
                    edgeMinimization: true,
                    parentCentralization: true,
                    shakeTowards: 'roots'
                }
            },
            physics: { enabled: false },
            interaction: { hover: true, tooltipDelay: 220, zoomView: true, dragView: true },
            configure: { enabled: false },
            nodes: {
                borderWidth: 2,
                shadow: true,
                font: { size: 16, face: FONT_VIS },
                margin: 14,
                widthConstraint: { maximum: 220 }
            },
            edges: {
                width: 2,
                shadow: true,
                arrows: { to: { enabled: true, scaleFactor: 1.2 } },
                font: { size: 12, face: FONT_VIS, align: 'middle' }
            }
        }
    );

    requestAnimationFrame(() => setTimeout(() => FitGraph(), 100));

    const zMin = 0.2;
    const zMax = 2;
    let badgeT;

    network.on('zoom', params => {
        let s = params.scale;
        if (s < zMin || s > zMax) {
            network.moveTo({
                position: network.getViewPosition(),
                scale: s < zMin ? zMin : zMax,
                animation: false
            });
        }
        clearTimeout(badgeT);
        badgeT = setTimeout(() => requestAnimationFrame(() => PlaceInsBadges()), 16);
    });

    network.on('click', params => {
        if (params.nodes.length) {
            const id = params.nodes[0];
            const n = nodes.get(id);
            if (n) PopNodePanel(n);
        } else document.getElementById('nodeInfo').classList.add('hidden');
    });

    network.on('stabilizationEnd', () => {
        requestAnimationFrame(() => setTimeout(() => PlaceInsBadges(), 50));
    });

    network.on('dragEnd', () => requestAnimationFrame(() => PlaceInsBadges()));
    network.on('dragStart', () => requestAnimationFrame(() => PlaceInsBadges()));
}

function PlaceInsBadges() {
    document.querySelectorAll('.insurance-badge-overlay').forEach(el => el.remove());
    if (!network) return;

    const host = document.getElementById('networkContainer');
    const canvas = host?.querySelector('canvas');
    if (!canvas || !host) return;

    const pos = network.getPositions();
    const cRect = canvas.getBoundingClientRect();
    const hRect = host.getBoundingClientRect();
    const scale = network.getScale();
    const vp = network.getViewPosition();
    const cw = canvas.width;
    const ch = canvas.height;
    const rx = cRect.width / cw;
    const ry = cRect.height / ch;
    const padX = cRect.left - hRect.left;
    const padY = cRect.top - hRect.top;

    for (const id of Object.keys(pos)) {
        const n = nodes.get(id);
        if (!n) continue;
        const tag = insTag(n.insuranceType);
        if (!tag) continue;

        const p = pos[id];
        const px = (p.x - vp.x) * scale + cw / 2;
        const py = (p.y - vp.y) * scale + ch / 2;
        const dx = px * rx + padX;
        const dy = py * ry + padY;
        const ox = -60 * scale;
        const oy = -25 * scale;

        const fs = Math.max(8, Math.min(16, 10 * scale));
        const padH = Math.max(2, Math.min(4, 2 * scale));
        const padW = Math.max(2, Math.min(8, 6 * scale));
        const br = Math.max(3, Math.min(6, 4 * scale));
        const bw = Math.max(1, Math.min(2, scale));

        const div = document.createElement('div');
        div.className = 'insurance-badge-overlay';
        div.textContent = tag;
        div.style.position = 'absolute';
        div.style.left = dx + ox + 'px';
        div.style.top = dy + oy + 'px';
        div.style.background = '#d32f2f';
        div.style.color = '#fff';
        div.style.padding = padH + 'px ' + padW + 'px';
        div.style.borderRadius = br + 'px';
        div.style.fontSize = fs + 'px';
        div.style.fontWeight = 'bold';
        div.style.border = bw + 'px solid rgba(255,255,255,0.3)';
        div.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        div.style.whiteSpace = 'nowrap';
        div.style.zIndex = '1000';
        div.style.pointerEvents = 'none';
        host.appendChild(div);
    }
}

function PopNodePanel(node) {
    const panel = document.getElementById('nodeInfo');
    document.getElementById('nodeTitle').textContent = node.label;
    const body = document.getElementById('nodeDetails');
    body.innerHTML = '';

    const tag = insTag(node.insuranceType);
    const insLabel = tag ? (tag === '∞' ? 'Lifetime Insurance (LTI)' : `${tag} Insurance`) : 'No Insurance';

    const rows = [
        ['Slug', node.slug],
        ['Type', node.isFullShip ? 'Full Ship' : 'Upgrade/Node'],
        ['Owned', node.owned ? 'Yes' : 'No'],
        ['Insurance', insLabel]
    ];
    if (node.pledge) {
        rows.push(['Pledge ID', node.pledge.pledgeId || 'N/A'], ['Date', node.pledge.date || 'N/A'], ['Cost', `$${node.pledge.cost || '0'}`]);
    }

    rows.forEach(([k, v]) => {
        const row = document.createElement('div');
        row.className = 'detail-row';
        const a = document.createElement('span');
        a.className = 'detail-label';
        a.textContent = `${k}:`;
        const b = document.createElement('span');
        b.className = 'detail-value';
        b.textContent = v != null ? String(v) : '';
        row.append(a, b);
        body.appendChild(row);
    });

    panel.classList.remove('hidden');
}
