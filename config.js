const config = {
  // Game settings
  playSnd: false,
  winForward: true,
  particle: true,
  ruleUI: true,
  
  // Custom levels configuration
  customLevels: [
    {
      id: '70b15d82-eaa9-11ef-a278-0afffd82ddb9',
      name: 'Level 1',
      description: 'The first custom level' // Optional field
    },
    // Add more levels here in the same format:
    // {
    //   id: 'level-uuid',
    //   name: 'Level Name',
    //   description: 'Level description'  
    // }
  ]
};

export default config;