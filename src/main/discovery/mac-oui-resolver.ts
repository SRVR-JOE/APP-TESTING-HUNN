/**
 * MAC OUI (Organizationally Unique Identifier) resolver.
 *
 * Resolves the first 3 octets of a MAC address to a manufacturer name
 * using a bundled database of common AV / broadcast equipment vendors.
 * No external network lookups are performed.
 */

const OUI_DATABASE: Record<string, string> = {
  // ── Luminex ──────────────────────────────────────────────────────────
  '00:50:C2': 'Luminex',

  // ── Audinate (Dante) ─────────────────────────────────────────────────
  '00:1D:C1': 'Audinate',

  // ── Shure ────────────────────────────────────────────────────────────
  '00:21:CC': 'Shure',
  '00:0E:DD': 'Shure',

  // ── QSC ──────────────────────────────────────────────────────────────
  'D8:80:39': 'QSC',
  '00:60:74': 'QSC',

  // ── Yamaha ───────────────────────────────────────────────────────────
  '00:1A:2B': 'Yamaha',
  '00:0E:7D': 'Yamaha',

  // ── Allen & Heath ────────────────────────────────────────────────────
  '00:04:A5': 'Allen & Heath',
  'A4:5E:60': 'Allen & Heath',

  // ── MA Lighting ──────────────────────────────────────────────────────
  '00:20:9A': 'MA Lighting',

  // ── ETC (Electronic Theatre Controls) ────────────────────────────────
  '00:A0:B0': 'ETC',

  // ── Riedel ───────────────────────────────────────────────────────────
  '00:14:C5': 'Riedel',

  // ── Clear-Com ────────────────────────────────────────────────────────
  '00:0B:D5': 'Clear-Com',
  '00:1C:AB': 'Clear-Com',

  // ── Ross Video ───────────────────────────────────────────────────────
  '00:14:E8': 'Ross Video',

  // ── Blackmagic Design ────────────────────────────────────────────────
  '7C:2E:0D': 'Blackmagic Design',

  // ── AJA Video Systems ────────────────────────────────────────────────
  '00:0C:17': 'AJA Video Systems',

  // ── NewTek / Vizrt (NDI) ─────────────────────────────────────────────
  '00:24:7E': 'NewTek',

  // ── BirdDog (NDI) ───────────────────────────────────────────────────
  '9C:EB:E8': 'BirdDog',

  // ── Sennheiser ───────────────────────────────────────────────────────
  '00:1B:66': 'Sennheiser',
  '00:17:A4': 'Sennheiser',

  // ── Biamp ────────────────────────────────────────────────────────────
  '00:1E:C0': 'Biamp',

  // ── Harman / BSS / Crown ─────────────────────────────────────────────
  '00:0A:3F': 'Harman',

  // ── Extron ───────────────────────────────────────────────────────────
  '00:05:A6': 'Extron',

  // ── Crestron ─────────────────────────────────────────────────────────
  '00:10:79': 'Crestron',

  // ── AMX (Harman) ─────────────────────────────────────────────────────
  '00:60:9F': 'AMX',

  // ── Barco ────────────────────────────────────────────────────────────
  '00:12:B8': 'Barco',

  // ── Panasonic ────────────────────────────────────────────────────────
  '00:80:45': 'Panasonic',
  '00:B0:C7': 'Panasonic',

  // ── Sony ─────────────────────────────────────────────────────────────
  '00:1A:80': 'Sony',
  'FC:0F:E6': 'Sony',

  // ── Cisco ────────────────────────────────────────────────────────────
  '00:1B:0D': 'Cisco',

  // ── Netgear ──────────────────────────────────────────────────────────
  '00:26:F2': 'Netgear',

  // ── Ubiquiti ─────────────────────────────────────────────────────────
  '24:A4:3C': 'Ubiquiti',

  // ── TP-Link ──────────────────────────────────────────────────────────
  '50:C7:BF': 'TP-Link',

  // ── Intel ────────────────────────────────────────────────────────────
  '00:16:76': 'Intel',

  // ── Supermicro ───────────────────────────────────────────────────────
  '00:25:90': 'Super Micro',

  // ── Raspberry Pi Foundation ──────────────────────────────────────────
  'B8:27:EB': 'Raspberry Pi',
  'DC:A6:32': 'Raspberry Pi',

  // ── Dallas Semiconductor / Maxim ─────────────────────────────────────
  '00:60:35': 'Dallas Semiconductor',

  // ── Xilinx (FPGA-based AV devices) ──────────────────────────────────
  '00:0A:35': 'Xilinx',

  // ── Newtec ───────────────────────────────────────────────────────────
  '00:11:7F': 'Newtec',

  // ── IEEE Registration Authority (many AV manufacturers) ──────────────
  '70:B3:D5': 'IEEE Registration Authority',

  // ── d&b audiotechnik ─────────────────────────────────────────────────
  '00:1D:B5': 'd&b audiotechnik',

  // ── L-Acoustics ──────────────────────────────────────────────────────
  '00:1C:A4': 'L-Acoustics',

  // ── Meyer Sound ──────────────────────────────────────────────────────
  '00:1B:77': 'Meyer Sound',

  // ── Focusrite / RedNet ───────────────────────────────────────────────
  '00:1A:4B': 'Focusrite',

  // ── MOTU ─────────────────────────────────────────────────────────────
  '00:23:C8': 'MOTU',

  // ── PreSonus ─────────────────────────────────────────────────────────
  '00:22:5F': 'PreSonus',

  // ── RME ──────────────────────────────────────────────────────────────
  '00:20:0D': 'RME',

  // ── Bosch / Telex ────────────────────────────────────────────────────
  '00:04:13': 'Bosch Security',

  // ── Grass Valley ─────────────────────────────────────────────────────
  '00:0D:7C': 'Grass Valley',

  // ── Evertz ───────────────────────────────────────────────────────────
  '00:1F:8B': 'Evertz',

  // ── Calrec ───────────────────────────────────────────────────────────
  '00:1C:F0': 'Calrec',

  // ── Lawo ─────────────────────────────────────────────────────────────
  '00:10:4B': 'Lawo',

  // ── Digigram ─────────────────────────────────────────────────────────
  '00:1A:7D': 'Digigram',
};

export class MacOuiResolver {
  /**
   * Normalize a MAC address to the colon-separated uppercase format XX:XX:XX:XX:XX:XX.
   * Accepts dash, colon, dot, or no separators.
   */
  normalizeMac(mac: string): string {
    // Strip all separators and whitespace
    const raw = mac.replace(/[:\-.\s]/g, '').toUpperCase();
    if (raw.length < 6) return mac.toUpperCase();

    // Rebuild as colon-separated pairs
    const pairs: string[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      pairs.push(raw.substring(i, i + 2));
    }
    return pairs.join(':');
  }

  /**
   * Extract the OUI prefix (first 3 octets) in XX:XX:XX form.
   */
  private extractOui(mac: string): string {
    const normalized = this.normalizeMac(mac);
    return normalized.substring(0, 8); // "XX:XX:XX"
  }

  /**
   * Resolve a MAC address to its manufacturer name, or undefined if unknown.
   */
  resolve(mac: string): string | undefined {
    const oui = this.extractOui(mac);
    return OUI_DATABASE[oui];
  }

  /**
   * Check whether the given MAC address belongs to a Luminex device.
   */
  isLuminex(mac: string): boolean {
    return this.resolve(mac) === 'Luminex';
  }
}
