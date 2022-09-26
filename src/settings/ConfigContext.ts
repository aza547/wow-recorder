import React from "react";
                            // TODO should be config type as first arg here
const ConfigContext = React.createContext<[any, React.Dispatch<any>]>([{}, () => {}]);

export default ConfigContext;
