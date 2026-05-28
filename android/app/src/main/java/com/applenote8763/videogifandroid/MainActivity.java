package com.applenote8763.videogifandroid;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGifConverterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
