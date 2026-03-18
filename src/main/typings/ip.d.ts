declare module 'ip' {
  export function address(): string;
  export function isV4Format(ip: string): boolean;
  export function isV6Format(ip: string): boolean;
  export function isPrivate(ip: string): boolean;
  export function isPublic(ip: string): boolean;
  export function toLong(ip: string): number;
  export function fromLong(long: number): string;
  export function subnet(ip: string, mask: string): {
    networkAddress: string;
    broadcastAddress: string;
    firstAddress: string;
    lastAddress: string;
    subnetMask: string;
    subnetMaskLength: number;
    numHosts: number;
    length: number;
  };
  export function cidr(cidrStr: string): {
    networkAddress: string;
    broadcastAddress: string;
    firstAddress: string;
    lastAddress: string;
    subnetMask: string;
    subnetMaskLength: number;
    numHosts: number;
    length: number;
  };
  export function cidrSubnet(cidrStr: string): {
    networkAddress: string;
    broadcastAddress: string;
    firstAddress: string;
    lastAddress: string;
    subnetMask: string;
    subnetMaskLength: number;
    numHosts: number;
    length: number;
    contains(ip: string): boolean;
  };
  export function not(ip: string): string;
  export function or(a: string, b: string): string;
  export function mask(ip: string, mask: string): string;
}
