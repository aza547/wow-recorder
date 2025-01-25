export default class VideoTag {
  public grouping;
  public label;
  public icon;
  public color;
  private static seperator = '|';

  constructor(grouping: number, label: string, icon: string, color: string) {
    this.grouping = grouping;
    this.label = label;
    this.icon = icon;
    this.color = color;
  }

  public static decode(encoded: string) {
    const [grouping, label, icon, color] = encoded.split(VideoTag.seperator);
    return new VideoTag(parseInt(grouping, 10), label, icon, color);
  }

  public encode() {
    return [
      this.grouping.toString().padStart(3, '0'),
      this.label,
      this.icon,
      this.color,
    ].join(VideoTag.seperator);
  }

  public getAsTag() {
    return {
      value: this.encode(),
      label: this.label,
    };
  }
}
