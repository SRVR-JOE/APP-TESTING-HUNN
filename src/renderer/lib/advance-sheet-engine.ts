// =============================================================================
// Advance Sheet Engine — Pure logic for generating tour advance sheets
// =============================================================================

import type {
  AdvanceSheet,
  AdvanceSheetSection,
  TourStop,
  VenueProfile,
  ShowFile,
  ShowFileSwitchConfig,
} from '@shared/types';

/**
 * Count switches by role and compute totals from a show file.
 */
function computeNetworkRequirements(showFile?: ShowFile): AdvanceSheetSection {
  if (!showFile || showFile.switches.length === 0) {
    return {
      title: 'Network Requirements',
      type: 'network-requirements',
      content:
        'No show file assigned. Network requirements will be determined on-site.\n\nRecommended minimum:\n  - 2x GigaCore switches (FOH + Stage)\n  - 1x Management VLAN\n  - 1x Dante Primary VLAN\n  - 1x sACN/Art-Net VLAN',
    };
  }

  const switches = showFile.switches;
  const switchCount = switches.length;

  const roleCounts: Record<string, number> = {};
  for (const sw of switches) {
    const role = sw.role ?? 'unassigned';
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  }

  const totalPorts = switches.reduce((sum, sw) => sum + sw.portConfigs.length, 0);
  const trunkPorts = switches.reduce(
    (sum, sw) => sum + sw.portConfigs.filter((p) => p.taggedVlans && p.taggedVlans.length > 0).length,
    0
  );

  const lines: string[] = [
    `Total Switches: ${switchCount}`,
    '',
    'Switch Breakdown:',
    ...Object.entries(roleCounts).map(([role, count]) => `  ${formatRole(role)}: ${count}`),
    '',
    `Total Ports: ${totalPorts}`,
    `Trunk Ports: ${trunkPorts}`,
    `Access Ports: ${totalPorts - trunkPorts}`,
  ];

  return {
    title: 'Network Requirements',
    type: 'network-requirements',
    content: lines.join('\n'),
  };
}

/**
 * Compute VLAN scheme from show file.
 */
function computeVlanScheme(showFile?: ShowFile, venue?: VenueProfile): AdvanceSheetSection {
  const lines: string[] = [];

  if (showFile && showFile.vlans.length > 0) {
    lines.push('Production VLANs:');
    for (const vlan of showFile.vlans) {
      lines.push(`  VLAN ${vlan.id} — ${vlan.name}`);
      lines.push(`    Tagged ports: ${vlan.tagged.length > 0 ? vlan.tagged.join(', ') : 'none'}`);
      lines.push(`    Untagged ports: ${vlan.untagged.length > 0 ? vlan.untagged.join(', ') : 'none'}`);
    }
  } else {
    lines.push('No production VLANs defined in show file.');
  }

  if (venue?.houseNetwork) {
    lines.push('');
    lines.push('House Network:');
    lines.push(`  Internet Drop: ${venue.houseNetwork.internetDrop ? 'Available' : 'Not available'}`);
    if (venue.houseNetwork.existingVlans && venue.houseNetwork.existingVlans.length > 0) {
      lines.push(`  Existing House VLANs: ${venue.houseNetwork.existingVlans.join(', ')}`);
    }
    if (venue.houseNetwork.houseSubnets && venue.houseNetwork.houseSubnets.length > 0) {
      lines.push(`  House Subnets: ${venue.houseNetwork.houseSubnets.join(', ')}`);
    }
    if (venue.houseNetwork.restrictions) {
      lines.push(`  Restrictions: ${venue.houseNetwork.restrictions}`);
    }
  }

  // IP ranges
  lines.push('');
  lines.push('IP Addressing:');
  lines.push('  Management: 10.0.0.0/24 (10.0.0.1 - 10.0.0.254)');
  lines.push('  Dante Primary: 10.10.0.0/24');
  lines.push('  Dante Secondary: 10.11.0.0/24');
  lines.push('  sACN/Lighting: 10.20.0.0/24');
  lines.push('  Comms: 10.50.0.0/24');

  return {
    title: 'VLAN Scheme & IP Ranges',
    type: 'vlan-scheme',
    content: lines.join('\n'),
  };
}

/**
 * Compute PoE / power requirements from show file.
 */
function computePowerRequirements(showFile?: ShowFile): AdvanceSheetSection {
  if (!showFile || showFile.switches.length === 0) {
    return {
      title: 'Power Requirements',
      type: 'power-requirements',
      content:
        'No show file assigned. Estimated power requirements:\n\n  - FOH rack: 1x 20A circuit (dedicated)\n  - Stage racks: 2x 20A circuits\n  - Delay towers: 1x 15A circuit each\n\nTotal estimated PoE draw: TBD',
    };
  }

  const switches = showFile.switches;
  let totalPoeBudget = 0;
  let totalPoeDraw = 0;
  const poeDetails: string[] = [];

  for (const sw of switches) {
    const budget = sw.poeSettings?.budgetW ?? 0;
    if (budget > 0) {
      const enabledPoePorts = sw.portConfigs.filter((p) => p.poeEnabled).length;
      // Estimate ~15W per PoE port as a rough average
      const estimatedDraw = enabledPoePorts * 15;
      totalPoeBudget += budget;
      totalPoeDraw += estimatedDraw;
      poeDetails.push(`  ${sw.name}: ${enabledPoePorts} PoE ports, ~${estimatedDraw}W / ${budget}W budget`);
    }
  }

  const lines: string[] = [];
  if (poeDetails.length > 0) {
    lines.push('PoE Switch Details:');
    lines.push(...poeDetails);
    lines.push('');
    lines.push(`Total PoE Budget: ${totalPoeBudget}W`);
    lines.push(`Estimated PoE Draw: ${totalPoeDraw}W`);
    lines.push(`PoE Headroom: ${totalPoeBudget - totalPoeDraw}W (${Math.round(((totalPoeBudget - totalPoeDraw) / totalPoeBudget) * 100)}%)`);
  } else {
    lines.push('No PoE switches in this configuration.');
  }

  lines.push('');
  lines.push('Power Circuits Required:');
  lines.push(`  - FOH rack: 1x 20A / 120V dedicated circuit`);
  lines.push(`  - Stage racks: ${Math.max(2, Math.ceil(switches.length / 4))}x 20A / 120V circuits`);
  lines.push(`  - UPS recommended for FOH core switch`);

  return {
    title: 'Power Requirements',
    type: 'power-requirements',
    content: lines.join('\n'),
  };
}

/**
 * Generate cable run section.
 */
function computeCableRuns(showFile?: ShowFile, venue?: VenueProfile): AdvanceSheetSection {
  const lines: string[] = [];

  if (showFile?.rackLayout?.connections && showFile.rackLayout.connections.length > 0) {
    lines.push('Inter-Switch Cable Runs:');
    for (const conn of showFile.rackLayout.connections) {
      const srcSwitch = showFile.switches.find((s) => s.switchId === conn.sourceSwitchId);
      const dstSwitch = showFile.switches.find((s) => s.switchId === conn.targetSwitchId);
      lines.push(
        `  ${srcSwitch?.name ?? conn.sourceSwitchId} port ${conn.sourcePort} --> ${dstSwitch?.name ?? conn.targetSwitchId} port ${conn.targetPort}${conn.label ? ` (${conn.label})` : ''}`
      );
    }
  } else {
    lines.push('Cable run details to be determined on-site.');
    lines.push('');
    lines.push('Standard Cable Kit (recommended):');
    lines.push('  - 4x Cat6a 100m drums');
    lines.push('  - 8x Cat6a 30m patch cables');
    lines.push('  - 12x Cat6a 5m patch cables');
    lines.push('  - 4x Cat6a 1m patch cables');
    lines.push('  - 2x Single-mode fiber 100m');
    lines.push('  - 4x LC-LC fiber patch cables');
  }

  if (venue?.cableInfrastructure) {
    lines.push('');
    lines.push('Venue Cable Infrastructure:');
    lines.push(`  ${venue.cableInfrastructure}`);
  }

  return {
    title: 'Cable Runs',
    type: 'cable-runs',
    content: lines.join('\n'),
  };
}

/**
 * Generate contact info section from venue.
 */
function computeContactInfo(venue?: VenueProfile, stopNotes?: string): AdvanceSheetSection {
  const lines: string[] = [];

  if (venue?.contacts && venue.contacts.length > 0) {
    lines.push('Venue Contacts:');
    for (const contact of venue.contacts) {
      lines.push(`  ${contact.name} — ${contact.role}`);
      if (contact.email) lines.push(`    Email: ${contact.email}`);
      if (contact.phone) lines.push(`    Phone: ${contact.phone}`);
      lines.push('');
    }
  } else {
    lines.push('No venue contacts on file. Please advance with venue directly.');
  }

  return {
    title: 'Contact Information',
    type: 'contact-info',
    content: lines.join('\n'),
  };
}

/**
 * Generate notes section.
 */
function computeNotes(stop: TourStop, venue?: VenueProfile): AdvanceSheetSection {
  const lines: string[] = [];

  if (stop.notes) {
    lines.push('Stop Notes:');
    lines.push(`  ${stop.notes}`);
    lines.push('');
  }

  if (venue?.notes) {
    lines.push('Venue Notes:');
    lines.push(`  ${venue.notes}`);
    lines.push('');
  }

  if (venue?.powerInfo) {
    lines.push('Venue Power Info:');
    lines.push(`  ${venue.powerInfo}`);
    lines.push('');
  }

  if (venue?.previousConfigs && venue.previousConfigs.length > 0) {
    lines.push(`Previous Configurations: ${venue.previousConfigs.length} show file(s) on record`);
  }

  if (lines.length === 0) {
    lines.push('No additional notes.');
  }

  return {
    title: 'Notes',
    type: 'notes',
    content: lines.join('\n'),
  };
}

function formatRole(role: string): string {
  return role
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Generate a full advance sheet for a tour stop.
 */
export function generateAdvanceSheet(
  tourStop: TourStop,
  venue?: VenueProfile,
  showFile?: ShowFile
): AdvanceSheet {
  const sections: AdvanceSheetSection[] = [
    computeNetworkRequirements(showFile),
    computeVlanScheme(showFile, venue),
    computePowerRequirements(showFile),
    computeCableRuns(showFile, venue),
    computeContactInfo(venue, tourStop.notes),
    computeNotes(tourStop, venue),
  ];

  return {
    id: `adv-${tourStop.id}-${Date.now()}`,
    tourStopId: tourStop.id,
    venueId: tourStop.venueId,
    generatedAt: new Date().toISOString(),
    sections,
  };
}

/**
 * Format an advance sheet as a printable text document.
 */
export function formatAdvanceSheetText(sheet: AdvanceSheet): string {
  const divider = '='.repeat(72);
  const sectionDivider = '-'.repeat(72);
  const lines: string[] = [];

  lines.push(divider);
  lines.push('  ADVANCE SHEET');
  lines.push(`  Generated: ${new Date(sheet.generatedAt).toLocaleString()}`);
  lines.push(`  Tour Stop ID: ${sheet.tourStopId}`);
  lines.push(`  Venue ID: ${sheet.venueId}`);
  lines.push(divider);
  lines.push('');

  for (const section of sheet.sections) {
    lines.push(sectionDivider);
    lines.push(`  ${section.title.toUpperCase()}`);
    lines.push(sectionDivider);
    lines.push('');
    lines.push(section.content);
    lines.push('');
  }

  lines.push(divider);
  lines.push('  END OF ADVANCE SHEET');
  lines.push(divider);

  return lines.join('\n');
}
