# ha-controller

Take control of your smart home directly from your wrist with Home Control for Fitbit Sense. Seamlessly integrate your Fitbit Sense with your Home Assistant setup and effortlessly manage your connected lights with just a few taps.

## Installation

1. Install the app on your Fitbit Sense from the [Fitbit app gallery](https://gallery.fitbit.com/details/1f78f2b5-2ba3-448b-b1ef-b45fa6f73c10)
2. [Enable the Home Assistant API](https://developers.home-assistant.io/docs/api/rest#:~:text=If%20you%20are%20not%20using%20the%20frontend%20in%20your%20setup%20then%20you%20need%20to%20add%20the%20api%20integration%20to%20your%20configuration.yaml%20file.) (if not already enabled)
3. [Generate a long-lived access token](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-token) from the [profile page](https://my.home-assistant.io/redirect/profile/) in the Home Assistant web frontend
4. Add your base homeassistant url (without https://) and long-lived access token to the app settings
5. Installation complete! 

## Issues

Please report any issues in [the issues tab](https://github.com/isaa-ctaylor/ha-controller/issues)