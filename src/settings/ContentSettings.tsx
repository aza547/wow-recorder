import * as React from 'react';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import FormLabel from '@mui/material/FormLabel';
import ConfigContext from "./ConfigContext";

export default function ContentSettings() {
  const [config, setConfig] = React.useContext(ConfigContext);

  const modifyConfig = (stateKey: string, value: any) => {
    setConfig((prevConfig) => ({ ...prevConfig, [stateKey]: value }));
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({
      ...config,
      [event.target.name]: event.target.checked,
    });
  };

  const getCheckBox = (preference: string) => {
    return (
      <Checkbox 
        checked={config[preference]} 
        onChange={handleChange} 
        name={preference}
        style = {checkBoxStyle} 
      />
    )
  }

  const checkBoxStyle = {color: "#bb4220", padding: 5};
  const formControlLabelStyle = {color: "white"};
  const formLabelStyle = {color: "white"};
  const formGroupStyle = {width: '48ch', padding: 1};

  return (
    <div>
      <FormLabel id="radios" sx={formLabelStyle}>Game Type</FormLabel>
      <Divider color="black" />
      <FormGroup sx={formGroupStyle}>
        <FormControlLabel control={getCheckBox("retail")} label="Retail" style = {formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("classic")} label="Classic" style = {formControlLabelStyle} />
      </FormGroup>
      <FormLabel id="radios" sx={formLabelStyle}>PvE</FormLabel>
      <Divider color="black" />
      <FormGroup sx={formGroupStyle}>
        <FormControlLabel control={getCheckBox("raids")} label="Raids" style = {formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("dungeons")} label="Mythic+" style = {formControlLabelStyle} />
      </FormGroup>
      <FormLabel id="radios" sx={formLabelStyle}>PvP</FormLabel>
      <Divider color="black" />
      <FormGroup sx={formGroupStyle}>
        <FormControlLabel control={getCheckBox("twoVTwo")} label="2v2" style = {formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("threeVThree")} label="3v3" style = {formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("skirmish")} label="Skirmish" style = {formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("soloShuffle")} label="Solo Shuffle" style = {formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("battlegrounds")} label="Battlegrounds" style = {formControlLabelStyle} />
      </FormGroup>
    </div>
  );
}