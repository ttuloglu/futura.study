package com.fortale.plugins.nativereader;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeBookReader")
public class NativeBookReaderPlugin extends Plugin {

    @PluginMethod
    public void openBook(PluginCall call) {
        JSArray pagesArray = call.getArray("pages");
        if (pagesArray == null || pagesArray.length() == 0) {
            call.reject("Kitap sayfaları bulunamadı");
            return;
        }

        String title = call.getString("title", "Kitap");
        String bookType = call.getString("bookType", "novel");
        String theme = call.getString("theme", "sepia");
        int initialPageIndex = call.getInt("initialPageIndex", 0);

        Intent intent = new Intent(getContext(), NativeReaderActivity.class);
        intent.putExtra("title", title);
        intent.putExtra("bookType", bookType);
        intent.putExtra("theme", theme);
        intent.putExtra("initialPageIndex", initialPageIndex);
        intent.putExtra("pagesJson", pagesArray.toString());

        startActivityForResult(call, intent, "handleReaderResult");
    }

    @ActivityCallback
    private void handleReaderResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        int lastIndex = 0;
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            lastIndex = result.getData().getIntExtra("lastPageIndex", 0);
        }
        JSObject ret = new JSObject();
        ret.put("closed", true);
        ret.put("lastPageIndex", lastIndex);
        call.resolve(ret);
    }
}
