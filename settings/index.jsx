registerSettingsPage(({ settings }) => (
  <Page>
    <TextInput
      label="Homeassistant URL"
      settingsKey="url"
    />
    <TextInput
      label="API Key"
      settingsKey="key"
      type="password"
    />
  </Page >
));
