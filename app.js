// ── NebulaOS Dynamic Download Hub ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  fetchGitHubReleases();
});

function extractRevisionNumber(str) {
  if (!str) return -1;
  const match = str.match(/rev(\d+)/i);
  return match ? parseInt(match[1], 10) : -1;
}

async function fetchGitHubReleases() {
  const GITHUB_API = 'https://api.github.com/repos/tnuproject/nebulaos/releases';

  // DOM Elements - Stable
  const stableVerEl = document.getElementById('stable-version');
  const stableSizeEl = document.getElementById('stable-size');
  const btnStable = document.getElementById('btn-download-stable');
  const btnStableText = document.getElementById('btn-stable-text');
  const stableShaLink = document.getElementById('stable-sha-link');

  // DOM Elements - Delta
  const deltaVerEl = document.getElementById('delta-version');
  const deltaSizeEl = document.getElementById('delta-size');
  const btnDelta = document.getElementById('btn-download-delta');
  const btnDeltaText = document.getElementById('btn-delta-text');
  const deltaShaLink = document.getElementById('delta-sha-link');

  try {
    const res = await fetch(GITHUB_API, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (!res.ok) {
      throw new Error(`GitHub API HTTP ${res.status}`);
    }

    const releases = await res.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      throw new Error('No releases array returned.');
    }

    let latestStable = null;
    let latestDelta = null;
    let maxDeltaRev = -1;

    // ── 1. Match Stable Releases (Strictly Non-Prerelease, with .iso asset) ──
    const nonPreReleases = releases.filter(r => {
      if (r.draft) return false;
      if (r.prerelease) return false;
      const full = `${r.tag_name || ''} ${r.name || ''}`.toLowerCase();
      // Exclude delta and revision markers
      if (full.includes('delta') || full.includes('rev')) return false;
      return true;
    });

    // Pick the most recent stable release that has an ISO file
    for (const r of nonPreReleases) {
      const assets = r.assets || [];
      const hasIso = assets.some(a => (a.name || '').toLowerCase().endsWith('.iso'));
      if (hasIso) {
        latestStable = r;
        break;
      }
    }

    // ── 2. Match Delta Releases (Highest Revision Number revX with .iso asset) ──
    for (const r of releases) {
      if (r.draft) continue;
      const isPre = Boolean(r.prerelease);
      const tag = r.tag_name || '';
      const name = r.name || '';
      const fullText = `${tag} ${name}`.toLowerCase();

      const assets = r.assets || [];
      const isoAsset = assets.find(a => (a.name || '').toLowerCase().endsWith('.iso'));
      const hasIso = Boolean(isoAsset);

      const isDelta = isPre || fullText.includes('delta') || fullText.includes('rev');

      if (isDelta) {
        const rev = extractRevisionNumber(`${fullText} ${isoAsset ? isoAsset.name : ''}`);
        if (hasIso) {
          if (rev > maxDeltaRev) {
            maxDeltaRev = rev;
            latestDelta = r;
          } else if (rev === maxDeltaRev && !latestDelta) {
            latestDelta = r;
          }
        } else if (!latestDelta && rev >= maxDeltaRev) {
          latestDelta = r;
        }
      }
    }

    // ── Apply Stable Release Data ──
    if (latestStable) {
      applyReleaseData({
        release: latestStable,
        verEl: stableVerEl,
        sizeEl: stableSizeEl,
        btnEl: btnStable,
        btnTextEl: btnStableText,
        shaEl: stableShaLink,
        btnLabelPrefix: 'Download Stable ISO',
        isDelta: false
      });
    } else {
      // If no official non-prerelease stable release has been uploaded to GitHub yet:
      if (stableVerEl) stableVerEl.textContent = '26.0 (Coming Soon)';
      if (stableSizeEl) stableSizeEl.textContent = 'In Preparation';
      if (btnStable) {
        btnStable.href = 'https://github.com/tnuproject/nebulaos/releases';
      }
      if (btnStableText) {
        btnStableText.textContent = 'Stable ISO (In Preparation)';
      }
      if (stableShaLink) {
        stableShaLink.style.display = 'none';
      }
    }

    // ── Apply Delta Release Data ──
    if (latestDelta) {
      applyReleaseData({
        release: latestDelta,
        verEl: deltaVerEl,
        sizeEl: deltaSizeEl,
        btnEl: btnDelta,
        btnTextEl: btnDeltaText,
        shaEl: deltaShaLink,
        btnLabelPrefix: 'Download Delta ISO',
        isDelta: true
      });
    }

  } catch (err) {
    console.warn('[NebulaOS] Falling back to default targets:', err);
    if (deltaVerEl && deltaVerEl.textContent === 'Loading...') deltaVerEl.textContent = '26.0-delta.rev2';
    if (stableVerEl && stableVerEl.textContent === 'Loading...') stableVerEl.textContent = '26.0 (Coming Soon)';
  }
}

function applyReleaseData({ release, verEl, sizeEl, btnEl, btnTextEl, shaEl, btnLabelPrefix, isDelta }) {
  const tagName = release.tag_name || '';
  const assets = release.assets || [];

  // Find ISO asset (.iso)
  const isoAsset = assets.find(a => (a.name || '').toLowerCase().endsWith('.iso'));
  // Find SHA256 checksum file (.sha256)
  const shaAsset = assets.find(a => (a.name || '').toLowerCase().endsWith('.sha256') || (a.name || '').toLowerCase().endsWith('.sha256sum'));

  // Clean version name for badge display
  let displayVer = release.name || tagName;
  displayVer = displayVer.replace(/^NebulaOS\s+/i, '').replace(/\"Apollo\"/g, '').replace(/\(Delta Channel\)/i, '').trim();

  // If revision is found for delta, format cleanly
  const revNum = extractRevisionNumber(`${tagName} ${release.name || ''} ${isoAsset ? isoAsset.name : ''}`);

  if (verEl) {
    verEl.textContent = displayVer || tagName;
  }

  if (isoAsset) {
    if (sizeEl) {
      sizeEl.textContent = formatBytes(isoAsset.size);
    }
    if (btnEl) {
      btnEl.href = isoAsset.browser_download_url;
      btnEl.setAttribute('download', isoAsset.name);
    }
    if (btnTextEl) {
      if (isDelta && revNum > 0) {
        btnTextEl.textContent = `${btnLabelPrefix} (rev${revNum})`;
      } else if (!isDelta && displayVer) {
        btnTextEl.textContent = `${btnLabelPrefix} (${displayVer})`;
      } else {
        btnTextEl.textContent = btnLabelPrefix;
      }
    }
  } else {
    if (btnEl) {
      btnEl.href = release.html_url;
    }
    if (btnTextEl) {
      btnTextEl.textContent = btnLabelPrefix;
    }
  }

  if (shaAsset && shaEl) {
    shaEl.href = shaAsset.browser_download_url;
    shaEl.style.display = 'inline';
  } else if (shaEl) {
    shaEl.href = release.html_url;
    shaEl.style.display = 'inline';
  }
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
