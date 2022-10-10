import { useState, useEffect } from 'react';
import { SaveStatus } from 'main/types';
import savingIcon from '../../assets/icon/saving-icon.png';

export default function SavingStatus() {
    const [status, setStatus] = useState(SaveStatus.NotSaving);

    useEffect(() => {
        window.electron.ipcRenderer.on('updateSaveStatus', (status) => {
            setStatus(status as SaveStatus);
        });
    }, []);

    return (
        <div id="saving-status">
            <div>
            { (status === SaveStatus.Saving) &&
                <img id='saving-icon' title={ 'Saving a recording...' } alt="icon" src={ savingIcon }/>
            }
            </div>
        </div>
    );
}
