// ── Excel Validation Engine ──────────────────────────────────────────────────
// Validates parsed Excel data against GigaCore requirements.

import {
  ExcelIPScheme,
  ExcelProfile,
  ExcelGroupDefinition,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  GIGACORE_MODELS,
  GigaCoreModel,
  MODEL_PORT_COUNTS,
} from './types';

export class ExcelValidator {
  /**
   * Validate a full IP Scheme dataset.
   */
  validateIPScheme(data: ExcelIPScheme): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateSwitches(data, errors, warnings);
    this.validateGroupDefinitions(data.groupDefinitions, errors, warnings);
    this.validatePortAssignments(data, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate profile data.
   */
  validateProfiles(data: ExcelProfile[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const profileNames = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      const profile = data[i];
      const row = i + 2; // accounting for header row

      if (!profile.switchName) {
        errors.push({
          sheet: 'Profile Config',
          row,
          column: 'A',
          message: 'Switch name is required',
        });
      }

      if (!profile.profileName) {
        errors.push({
          sheet: 'Profile Config',
          row,
          column: 'B',
          message: 'Profile name is required',
        });
      }

      profileNames.add(profile.profileName);

      // Validate port configs within the profile
      for (let p = 0; p < profile.portConfigs.length; p++) {
        const pc = profile.portConfigs[p];
        const portRow = p + 2;
        const sheetName = `Profile: ${profile.profileName}`;

        if (pc.port < 1 || pc.port > 48) {
          errors.push({
            sheet: sheetName,
            row: portRow,
            column: 'A',
            message: `Invalid port number: ${pc.port}`,
            value: String(pc.port),
          });
        }

        if (pc.mode === 'trunk' && !pc.trunkGroups) {
          warnings.push({
            sheet: sheetName,
            row: portRow,
            column: 'E',
            message: 'Trunk port has no trunk groups specified',
            value: String(pc.port),
          });
        }

        if (pc.mode === 'access' && pc.trunkGroups) {
          warnings.push({
            sheet: sheetName,
            row: portRow,
            column: 'E',
            message: 'Access port has trunk groups specified — they will be ignored',
            value: pc.trunkGroups,
          });
        }
      }

      // Validate groups within the profile
      this.validateGroupDefinitions(profile.groups, errors, warnings, `Profile: ${profile.profileName}`);
    }

    // Check for profiles referenced but no sheet found (empty port configs)
    for (const profile of data) {
      if (profile.portConfigs.length === 0 && profile.groups.length === 0) {
        warnings.push({
          sheet: 'Profile Config',
          row: 0,
          column: '',
          message: `Profile "${profile.profileName}" is referenced but has no configuration sheet or it is empty`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Parse port range strings like "4-8", "1,3,5", "ISL1", "1".
   * Returns array of numeric port numbers. ISL ports return high numbers (101+).
   */
  parsePortRange(portStr: string, model: string): number[] {
    const trimmed = portStr.trim();

    // ISL port
    const islMatch = trimmed.match(/^ISL(\d+)$/i);
    if (islMatch) {
      return [100 + parseInt(islMatch[1], 10)];
    }

    const ports: number[] = [];

    // Comma-separated segments
    const segments = trimmed.split(',');
    for (const segment of segments) {
      const seg = segment.trim();

      // Range: "4-8"
      const rangeMatch = seg.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (start <= end && start >= 1 && end <= 128) {
          for (let p = start; p <= end; p++) {
            ports.push(p);
          }
        }
        continue;
      }

      // Single number
      const num = parseInt(seg, 10);
      if (!isNaN(num) && num >= 1) {
        ports.push(num);
      }
    }

    return ports;
  }

  /**
   * Validate a single IPv4 address string.
   */
  isValidIPv4(ip: string): boolean {
    const trimmed = ip.trim();
    const parts = trimmed.split('.');
    if (parts.length !== 4) return false;
    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part)) return false;
      const num = parseInt(part, 10);
      if (num < 0 || num > 255) return false;
      // Reject leading zeros (e.g., "01" for octet)
      if (part.length > 1 && part.startsWith('0')) return false;
    }
    return true;
  }

  /**
   * Check if an IP address falls within a given subnet.
   * @param ip - IPv4 address (e.g., "192.168.1.10")
   * @param subnet - Network address (e.g., "192.168.1.0") or gateway/other IP in the subnet
   * @param mask - Subnet mask (e.g., "255.255.255.0")
   */
  isIpInSubnet(ip: string, subnet: string, mask: string): boolean {
    const ipNum = this.ipToNumber(ip);
    const subnetNum = this.ipToNumber(subnet);
    const maskNum = this.maskToNumber(mask);

    if (ipNum === null || subnetNum === null || maskNum === null) return false;

    return (ipNum & maskNum) === (subnetNum & maskNum);
  }

  // ── Private validation methods ─────────────────────────────────────────────

  private validateSwitches(
    data: ExcelIPScheme,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const seenNames = new Set<string>();
    const seenIps = new Set<string>();

    for (let i = 0; i < data.switches.length; i++) {
      const sw = data.switches[i];
      const row = i + 2; // 1-based, header is row 1

      // Required fields
      if (!sw.switchName) {
        errors.push({ sheet: 'IP Scheme', row, column: 'A', message: 'Switch name is required' });
      }
      if (!sw.model) {
        errors.push({ sheet: 'IP Scheme', row, column: 'B', message: 'Model is required' });
      }
      if (!sw.managementIp) {
        errors.push({ sheet: 'IP Scheme', row, column: 'C', message: 'Management IP is required' });
      }
      if (!sw.subnet) {
        errors.push({ sheet: 'IP Scheme', row, column: 'D', message: 'Subnet is required' });
      }

      // Validate model
      if (sw.model && !(GIGACORE_MODELS as readonly string[]).includes(sw.model)) {
        errors.push({
          sheet: 'IP Scheme',
          row,
          column: 'B',
          message: `Invalid model "${sw.model}". Valid models: ${GIGACORE_MODELS.join(', ')}`,
          value: sw.model,
        });
      }

      // Validate IP addresses
      if (sw.managementIp && !this.isValidIPv4(sw.managementIp)) {
        errors.push({
          sheet: 'IP Scheme',
          row,
          column: 'C',
          message: `Invalid IPv4 address: "${sw.managementIp}"`,
          value: sw.managementIp,
        });
      }

      if (sw.subnet && !this.isValidSubnetMask(sw.subnet)) {
        errors.push({
          sheet: 'IP Scheme',
          row,
          column: 'D',
          message: `Invalid subnet mask: "${sw.subnet}"`,
          value: sw.subnet,
        });
      }

      if (sw.gateway && !this.isValidIPv4(sw.gateway)) {
        errors.push({
          sheet: 'IP Scheme',
          row,
          column: 'E',
          message: `Invalid gateway IP: "${sw.gateway}"`,
          value: sw.gateway,
        });
      }

      // Gateway should be in the same subnet as management IP
      if (sw.managementIp && sw.gateway && sw.subnet) {
        if (
          this.isValidIPv4(sw.managementIp) &&
          this.isValidIPv4(sw.gateway) &&
          this.isValidSubnetMask(sw.subnet)
        ) {
          if (!this.isIpInSubnet(sw.gateway, sw.managementIp, sw.subnet)) {
            errors.push({
              sheet: 'IP Scheme',
              row,
              column: 'E',
              message: `Gateway ${sw.gateway} is not in the same subnet as management IP ${sw.managementIp}/${sw.subnet}`,
              value: sw.gateway,
            });
          }
        }
      }

      // VLAN range
      if (sw.vlanMgmt < 1 || sw.vlanMgmt > 4094) {
        errors.push({
          sheet: 'IP Scheme',
          row,
          column: 'F',
          message: `VLAN ID must be between 1 and 4094, got ${sw.vlanMgmt}`,
          value: String(sw.vlanMgmt),
        });
      }

      // Duplicate switch name
      if (sw.switchName) {
        const nameLower = sw.switchName.toLowerCase();
        if (seenNames.has(nameLower)) {
          errors.push({
            sheet: 'IP Scheme',
            row,
            column: 'A',
            message: `Duplicate switch name: "${sw.switchName}"`,
            value: sw.switchName,
          });
        }
        seenNames.add(nameLower);
      }

      // Duplicate management IP
      if (sw.managementIp) {
        if (seenIps.has(sw.managementIp)) {
          errors.push({
            sheet: 'IP Scheme',
            row,
            column: 'C',
            message: `Duplicate management IP: "${sw.managementIp}"`,
            value: sw.managementIp,
          });
        }
        seenIps.add(sw.managementIp);
      }

      // Warnings
      if (!sw.gateway) {
        warnings.push({
          sheet: 'IP Scheme',
          row,
          column: 'E',
          message: 'No gateway specified',
        });
      }

      if (!sw.locationRack) {
        warnings.push({
          sheet: 'IP Scheme',
          row,
          column: 'G',
          message: 'No location/rack specified',
        });
      }
    }
  }

  private validateGroupDefinitions(
    groups: ExcelGroupDefinition[],
    errors: ValidationError[],
    warnings: ValidationWarning[],
    sheetName = 'Group Definitions',
  ): void {
    const seenGroupNumbers = new Set<number>();
    const seenVlanIds = new Set<number>();
    const seenNames = new Set<string>();

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const row = i + 2;

      // Required fields
      if (!g.name) {
        errors.push({ sheet: sheetName, row, column: 'B', message: 'Group name is required' });
      }

      // VLAN range
      if (g.vlanId < 1 || g.vlanId > 4094) {
        errors.push({
          sheet: sheetName,
          row,
          column: 'C',
          message: `VLAN ID must be between 1 and 4094, got ${g.vlanId}`,
          value: String(g.vlanId),
        });
      }

      // Group number range (GigaCore supports 1-8 typically)
      if (g.groupNumber < 1 || g.groupNumber > 16) {
        errors.push({
          sheet: sheetName,
          row,
          column: 'A',
          message: `Group number must be between 1 and 16, got ${g.groupNumber}`,
          value: String(g.groupNumber),
        });
      }

      // Duplicate group number
      if (seenGroupNumbers.has(g.groupNumber)) {
        errors.push({
          sheet: sheetName,
          row,
          column: 'A',
          message: `Duplicate group number: ${g.groupNumber}`,
          value: String(g.groupNumber),
        });
      }
      seenGroupNumbers.add(g.groupNumber);

      // Duplicate VLAN ID (warning — might be intentional)
      if (seenVlanIds.has(g.vlanId)) {
        warnings.push({
          sheet: sheetName,
          row,
          column: 'C',
          message: `VLAN ID ${g.vlanId} is used by multiple groups`,
          value: String(g.vlanId),
        });
      }
      seenVlanIds.add(g.vlanId);

      // Duplicate name
      if (g.name) {
        const nameLower = g.name.toLowerCase();
        if (seenNames.has(nameLower)) {
          errors.push({
            sheet: sheetName,
            row,
            column: 'B',
            message: `Duplicate group name: "${g.name}"`,
            value: g.name,
          });
        }
        seenNames.add(nameLower);
      }

      // IGMP querier without snooping
      if (g.igmpQuerier && !g.igmpSnooping) {
        warnings.push({
          sheet: sheetName,
          row,
          column: 'F',
          message: 'IGMP Querier is enabled but IGMP Snooping is off — querier has no effect without snooping',
        });
      }
    }
  }

  private validatePortAssignments(
    data: ExcelIPScheme,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const switchNameSet = new Set(data.switches.map((s) => s.switchName.toLowerCase()));
    const groupNameSet = new Set(data.groupDefinitions.map((g) => g.name.toLowerCase()));
    const groupVlanSet = new Set(data.groupDefinitions.map((g) => String(g.vlanId)));

    // Build model lookup
    const switchModelMap = new Map<string, string>();
    for (const sw of data.switches) {
      switchModelMap.set(sw.switchName.toLowerCase(), sw.model);
    }

    for (let i = 0; i < data.portAssignments.length; i++) {
      const pa = data.portAssignments[i];
      const row = i + 2;

      // Switch name must reference a defined switch
      if (pa.switchName && !switchNameSet.has(pa.switchName.toLowerCase())) {
        errors.push({
          sheet: 'Port Assignments',
          row,
          column: 'A',
          message: `Switch "${pa.switchName}" not found in IP Scheme sheet`,
          value: pa.switchName,
        });
      }

      // Group/VLAN must reference a defined group (by name or VLAN ID) unless it's "Trunk"
      if (pa.groupVlan) {
        const gvLower = pa.groupVlan.toLowerCase();
        if (
          gvLower !== 'trunk' &&
          !groupNameSet.has(gvLower) &&
          !groupVlanSet.has(pa.groupVlan)
        ) {
          errors.push({
            sheet: 'Port Assignments',
            row,
            column: 'C',
            message: `Group/VLAN "${pa.groupVlan}" not found in Group Definitions`,
            value: pa.groupVlan,
          });
        }
      }

      // Validate port numbers for the model
      if (pa.switchName && pa.port) {
        const model = switchModelMap.get(pa.switchName.toLowerCase());
        if (model && (GIGACORE_MODELS as readonly string[]).includes(model)) {
          const ports = this.parsePortRange(pa.port, model);
          const modelPorts = MODEL_PORT_COUNTS[model as GigaCoreModel];
          const maxPort = modelPorts.copper + modelPorts.sfp;
          const maxIsl = modelPorts.isl;

          for (const p of ports) {
            if (p > 100) {
              // ISL port
              const islNum = p - 100;
              if (islNum > maxIsl || islNum < 1) {
                errors.push({
                  sheet: 'Port Assignments',
                  row,
                  column: 'B',
                  message: `ISL${islNum} is invalid for model ${model} (max ISL: ${maxIsl})`,
                  value: pa.port,
                });
              }
            } else if (p > maxPort) {
              errors.push({
                sheet: 'Port Assignments',
                row,
                column: 'B',
                message: `Port ${p} exceeds max port count for ${model} (max: ${maxPort})`,
                value: pa.port,
              });
            }
          }

          if (ports.length === 0) {
            errors.push({
              sheet: 'Port Assignments',
              row,
              column: 'B',
              message: `Cannot parse port value: "${pa.port}"`,
              value: pa.port,
            });
          }
        }
      }

      // Warn if no label
      if (!pa.label) {
        warnings.push({
          sheet: 'Port Assignments',
          row,
          column: 'D',
          message: 'No label for port assignment',
        });
      }
    }
  }

  // ── IP/Subnet helpers ──────────────────────────────────────────────────────

  private ipToNumber(ip: string): number | null {
    if (!this.isValidIPv4(ip)) return null;
    const parts = ip.split('.').map(Number);
    // Use unsigned 32-bit arithmetic
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  private maskToNumber(mask: string): number | null {
    // Support CIDR notation ("/24") or dotted notation ("255.255.255.0")
    if (mask.startsWith('/')) {
      const bits = parseInt(mask.slice(1), 10);
      if (bits < 0 || bits > 32) return null;
      if (bits === 0) return 0;
      return ((0xFFFFFFFF << (32 - bits)) & 0xFFFFFFFF) >>> 0;
    }
    return this.ipToNumber(mask);
  }

  /**
   * Validate that a string is a valid subnet mask (contiguous 1-bits followed by 0-bits).
   * Accepts dotted notation (255.255.255.0) or CIDR (/24).
   */
  private isValidSubnetMask(mask: string): boolean {
    if (mask.startsWith('/')) {
      const bits = parseInt(mask.slice(1), 10);
      return !isNaN(bits) && bits >= 0 && bits <= 32;
    }

    if (!this.isValidIPv4(mask)) return false;

    const num = this.ipToNumber(mask);
    if (num === null) return false;

    // A valid subnet mask in binary is all 1s followed by all 0s
    // Invert: all 0s followed by all 1s → adding 1 should be a power of 2
    if (num === 0xFFFFFFFF) return true; // /32
    if (num === 0) return true; // /0

    const inverted = (~num) >>> 0;
    return (inverted & (inverted + 1)) === 0;
  }
}
