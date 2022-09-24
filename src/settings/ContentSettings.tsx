import * as React from 'react';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import FormLabel from '@mui/material/FormLabel';

export default function ContentSettings() {

  return (
    <div>
      <FormLabel id="radios" sx={{color: "white"}}>Game Type</FormLabel>
      <Divider color="black" />
      <FormGroup sx={{ width: '48ch', padding: 1 }} >
        <FormControlLabel control={<Checkbox defaultChecked style = {{color: "#bb4220", padding: 5}} />} label="Retail" style = {{color: "white"}} />
        <FormControlLabel control={<Checkbox defaultChecked style = {{color: "#bb4220", padding: 5}} />} label="Classic" style = {{color: "white"}} />
      </FormGroup>
      <FormLabel id="radios" sx={{color: "white"}}>PvE</FormLabel>
      <Divider color="black" />
      <FormGroup sx={{ width: '48ch', padding: 1 }} >
        <FormControlLabel control={<Checkbox defaultChecked style = {{color: "#bb4220", padding: 5}} />} label="Raids" style = {{color: "white"}} />
        <FormControlLabel control={<Checkbox defaultChecked style = {{color: "#bb4220", padding: 5}} />} label="Mythic+" style = {{color: "white"}} />
      </FormGroup>
      <FormLabel id="radios" sx={{color: "white", gap: 2}}>PvP</FormLabel>
      <Divider color="black" />
      <FormGroup sx={{ width: '48ch', padding: 1 }} >
        <FormControlLabel control={<Checkbox defaultChecked style = {{color: "#bb4220", padding: 5}} />} label="2v2" style = {{color: "white"}} />
        <FormControlLabel control={<Checkbox defaultChecked style = {{color: "#bb4220", padding: 5}} />} label="3v3" style = {{color: "white"}} />
        <FormControlLabel control={<Checkbox defaultChecked style = {{color: "#bb4220", padding: 5}} />} label="Skirmish" style = {{color: "white"}} />
        <FormControlLabel control={<Checkbox defaultChecked style = {{color: "#bb4220", padding: 5}} />} label="Solo Shuffle" style = {{color: "white"}} />
        <FormControlLabel control={<Checkbox defaultChecked style = {{color: "#bb4220", padding: 5}} />} label="Battlegrounds" style = {{color: "white"}} />
      </FormGroup>
    </div>
  );
}