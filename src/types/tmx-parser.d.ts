declare module 'tmx-parser' {
  export function parse(responseText: string, route: string, param3: (err: Error, map: ITMXData) => void): void;
}
