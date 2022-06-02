import recordIcon from '../../assets/record.png';
import eyeIcon from  '../../assets/icons8-eye-30.png';

export default function Status() {

  /**
   * Get the status, either watching, recording, or error.
   */
  function getStatus() {
    if (1) {
      return(
        <div id="status">
          <img id="eye-icon" alt="icon" src={eyeIcon}/>
        </div>
      )}
    else {
      return(
        <div id="status">
          <img id="status-icon" alt="icon" src={recordIcon}/>
        </div>
      )}
    }

  return (
    getStatus()
  );
}
