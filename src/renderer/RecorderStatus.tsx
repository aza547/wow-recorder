import watchIcon from '../../assets/icon/watch-icon.png';

export default function RecorderStatus() {
  return (
    <div id="recstatus-button-div">
    <button
      id="rec-status-button"
      type="button"
      // onClick={openDiscordURL}
      title="Status"
    >
      <img alt="icon" src={watchIcon} height="25px" width="25px" />
    </button>
  </div>
  );
}
