import icon from '../../assets/computer-icon.svg';

export default function TitleBar() {
  return (
    <div id="title-bar">
      <div id="logo">
        <img alt="icon" src={icon} height="25px" width="25px" />
      </div>
      <div id="title">Warcraft Recorder</div>
      <div id="title-bar-btns">
        <button id="min-btn">🗕</button>
        <button id="max-btn">🗗</button>
        <button id="close-btn">✖</button>
      </div>
    </div>
  );
}
