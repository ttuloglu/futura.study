package com.fortale.plugins.nativereader;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.Html;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.RecyclerView;
import androidx.viewpager2.widget.ViewPager2;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class NativeReaderActivity extends AppCompatActivity {

    public static class PageItem {
        public int pageNumber;
        public String chapterTitle;
        public String title;
        public String contentHtml;
        public String plainText;
        public String imageSrc;
    }

    private ViewPager2 viewPager;
    private FrameLayout rootLayout;
    private LinearLayout topBar;
    private LinearLayout bottomBar;
    private TextView titleTextView;
    private TextView pageIndicatorTextView;
    private SeekBar pageSeekBar;
    private List<PageItem> pageList = new ArrayList<>();
    private String currentTheme = "sepia";
    private float fontScale = 1.0f;
    private boolean controlsVisible = true;
    private PageAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String title = getIntent().getStringExtra("title");
        if (title == null) title = "Kitap";
        currentTheme = getIntent().getStringExtra("theme");
        if (currentTheme == null) currentTheme = "sepia";
        int initialIndex = getIntent().getIntExtra("initialPageIndex", 0);
        String pagesJson = getIntent().getStringExtra("pagesJson");

        parsePages(pagesJson);

        rootLayout = new FrameLayout(this);
        setContentView(rootLayout);

        setupViewPager();
        setupControls(title);
        applyTheme();

        if (initialIndex >= 0 && initialIndex < pageList.size()) {
            viewPager.setCurrentItem(initialIndex, false);
        }
        updateIndicator(viewPager.getCurrentItem());
    }

    private void parsePages(String json) {
        if (json == null) return;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                PageItem item = new PageItem();
                item.pageNumber = obj.optInt("pageNumber", i + 1);
                item.chapterTitle = obj.optString("chapterTitle", "");
                item.title = obj.optString("title", "");
                item.contentHtml = obj.optString("contentHtml", "");
                item.plainText = obj.optString("plainText", "");
                item.imageSrc = obj.optString("imageSrc", null);
                pageList.add(item);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void setupViewPager() {
        viewPager = new ViewPager2(this);
        adapter = new PageAdapter();
        viewPager.setAdapter(adapter);
        rootLayout.addView(viewPager, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        viewPager.registerOnPageChangeCallback(new ViewPager2.OnPageChangeCallback() {
            @Override
            public void onPageSelected(int position) {
                super.onPageSelected(position);
                updateIndicator(position);
            }
        });
    }

    private void setupControls(String title) {
        // Top Bar
        topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        int pad = dpToPx(12);
        topBar.setPadding(pad, pad, pad, pad);

        TextView closeBtn = new TextView(this);
        closeBtn.setText("✕");
        closeBtn.setTextSize(18);
        closeBtn.setTypeface(Typeface.DEFAULT_BOLD);
        closeBtn.setPadding(dpToPx(8), dpToPx(4), dpToPx(12), dpToPx(4));
        closeBtn.setOnClickListener(v -> finishWithResult());
        topBar.addView(closeBtn);

        titleTextView = new TextView(this);
        titleTextView.setText(title);
        titleTextView.setTextSize(15);
        titleTextView.setTypeface(Typeface.DEFAULT_BOLD);
        titleTextView.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f));
        titleTextView.setSingleLine(true);
        topBar.addView(titleTextView);

        TextView fontDown = new TextView(this);
        fontDown.setText("A-");
        fontDown.setTextSize(13);
        fontDown.setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(4));
        fontDown.setOnClickListener(v -> {
            if (fontScale > 0.85f) {
                fontScale -= 0.10f;
                adapter.notifyDataSetChanged();
            }
        });
        topBar.addView(fontDown);

        TextView fontUp = new TextView(this);
        fontUp.setText("A+");
        fontUp.setTextSize(14);
        fontUp.setTypeface(Typeface.DEFAULT_BOLD);
        fontUp.setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(4));
        fontUp.setOnClickListener(v -> {
            if (fontScale < 1.45f) {
                fontScale += 0.10f;
                adapter.notifyDataSetChanged();
            }
        });
        topBar.addView(fontUp);

        TextView themeBtn = new TextView(this);
        themeBtn.setText("◐");
        themeBtn.setTextSize(18);
        themeBtn.setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(4));
        themeBtn.setOnClickListener(v -> cycleTheme());
        topBar.addView(themeBtn);

        FrameLayout.LayoutParams topParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.TOP
        );
        rootLayout.addView(topBar, topParams);

        // Bottom Bar
        bottomBar = new LinearLayout(this);
        bottomBar.setOrientation(LinearLayout.VERTICAL);
        bottomBar.setGravity(Gravity.CENTER_HORIZONTAL);
        bottomBar.setPadding(pad, pad, pad, pad);

        pageSeekBar = new SeekBar(this);
        pageSeekBar.setMax(Math.max(0, pageList.size() - 1));
        pageSeekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser) {
                    viewPager.setCurrentItem(progress, true);
                }
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
        bottomBar.addView(pageSeekBar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        pageIndicatorTextView = new TextView(this);
        pageIndicatorTextView.setTextSize(12);
        pageIndicatorTextView.setGravity(Gravity.CENTER);
        bottomBar.addView(pageIndicatorTextView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        FrameLayout.LayoutParams botParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM
        );
        rootLayout.addView(bottomBar, botParams);
    }

    private void cycleTheme() {
        if ("sepia".equals(currentTheme)) currentTheme = "dark";
        else if ("dark".equals(currentTheme)) currentTheme = "light";
        else currentTheme = "sepia";
        applyTheme();
    }

    private void applyTheme() {
        int bgColor, textColor, secColor, barBg;
        if ("dark".equals(currentTheme)) {
            bgColor = Color.parseColor("#121417");
            textColor = Color.parseColor("#E6E6E6");
            secColor = Color.parseColor("#8E9297");
            barBg = Color.parseColor("#D01C1E22");
        } else if ("light".equals(currentTheme)) {
            bgColor = Color.parseColor("#FAFAFA");
            textColor = Color.parseColor("#1F1F1F");
            secColor = Color.parseColor("#6E7176");
            barBg = Color.parseColor("#E8FFFFFF");
        } else { // sepia
            bgColor = Color.parseColor("#F7EFE4");
            textColor = Color.parseColor("#382D22");
            secColor = Color.parseColor("#806D5C");
            barBg = Color.parseColor("#E8EFE5D8");
        }

        rootLayout.setBackgroundColor(bgColor);
        topBar.setBackgroundColor(barBg);
        bottomBar.setBackgroundColor(barBg);
        titleTextView.setTextColor(textColor);
        pageIndicatorTextView.setTextColor(secColor);

        for (int i = 0; i < topBar.getChildCount(); i++) {
            View child = topBar.getChildAt(i);
            if (child instanceof TextView) {
                ((TextView) child).setTextColor(textColor);
            }
        }

        adapter.notifyDataSetChanged();
    }

    private void updateIndicator(int pos) {
        int total = pageList.size();
        int current = pos + 1;
        int pct = total > 0 ? (current * 100 / total) : 0;
        pageIndicatorTextView.setText("Sayfa " + current + " / " + total + " • %" + pct);
        pageSeekBar.setProgress(pos);
    }

    private void toggleControls() {
        controlsVisible = !controlsVisible;
        topBar.setVisibility(controlsVisible ? View.VISIBLE : View.GONE);
        bottomBar.setVisibility(controlsVisible ? View.VISIBLE : View.GONE);
    }

    private void finishWithResult() {
        Intent data = new Intent();
        data.putExtra("lastPageIndex", viewPager.getCurrentItem());
        setResult(Activity.RESULT_OK, data);
        finish();
    }

    @Override
    public void onBackPressed() {
        finishWithResult();
    }

    private int dpToPx(int dp) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp,
            getResources().getDisplayMetrics()
        );
    }

    private class PageAdapter extends RecyclerView.Adapter<PageViewHolder> {
        @NonNull
        @Override
        public PageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            ScrollView scrollView = new ScrollView(NativeReaderActivity.this);
            scrollView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ));
            scrollView.setClipToPadding(false);
            scrollView.setPadding(dpToPx(24), dpToPx(64), dpToPx(24), dpToPx(84));

            LinearLayout content = new LinearLayout(NativeReaderActivity.this);
            content.setOrientation(LinearLayout.VERTICAL);
            scrollView.addView(content, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ));

            scrollView.setOnClickListener(v -> toggleControls());
            content.setOnClickListener(v -> toggleControls());

            return new PageViewHolder(scrollView, content);
        }

        @Override
        public void onBindViewHolder(@NonNull PageViewHolder holder, int position) {
            PageItem item = pageList.get(position);
            holder.bind(item, currentTheme, fontScale);
        }

        @Override
        public int getItemCount() {
            return pageList.size();
        }
    }

    private class PageViewHolder extends RecyclerView.ViewHolder {
        private final LinearLayout container;

        public PageViewHolder(@NonNull View itemView, LinearLayout container) {
            super(itemView);
            this.container = container;
        }

        public void bind(PageItem item, String theme, float scale) {
            container.removeAllViews();

            int textColor = "dark".equals(theme) ? Color.parseColor("#E6E6E6") : ("sepia".equals(theme) ? Color.parseColor("#382D22") : Color.parseColor("#1F1F1F"));
            int secColor = "dark".equals(theme) ? Color.parseColor("#8E9297") : ("sepia".equals(theme) ? Color.parseColor("#806D5C") : Color.parseColor("#6E7176"));

            // Chapter Title
            if (item.chapterTitle != null && !item.chapterTitle.isEmpty()) {
                TextView ch = new TextView(NativeReaderActivity.this);
                ch.setText(item.chapterTitle.toUpperCase());
                ch.setTextSize(11);
                ch.setTypeface(Typeface.DEFAULT_BOLD);
                ch.setTextColor(secColor);
                ch.setGravity(Gravity.CENTER);
                ch.setPadding(0, 0, 0, dpToPx(12));
                container.addView(ch);
            }

            // Title
            if (item.title != null && !item.title.isEmpty()) {
                TextView t = new TextView(NativeReaderActivity.this);
                t.setText(item.title);
                t.setTextSize(20 * scale);
                t.setTypeface(Typeface.SERIF, Typeface.BOLD);
                t.setTextColor(textColor);
                t.setPadding(0, 0, 0, dpToPx(12));
                container.addView(t);
            }

            // Body
            TextView body = new TextView(NativeReaderActivity.this);
            body.setTextSize(16 * scale);
            body.setLineSpacing(dpToPx(4) * scale, 1.25f);
            body.setTypeface(Typeface.SERIF);
            body.setTextColor(textColor);

            if (item.contentHtml != null && !item.contentHtml.isEmpty()) {
                body.setText(Html.fromHtml(item.contentHtml, Html.FROM_HTML_MODE_COMPACT));
            } else if (item.plainText != null) {
                body.setText(item.plainText);
            }
            container.addView(body);

            // Page Number
            TextView num = new TextView(NativeReaderActivity.this);
            num.setText(String.valueOf(item.pageNumber));
            num.setTextSize(11);
            num.setTextColor(secColor);
            num.setGravity(Gravity.CENTER);
            num.setPadding(0, dpToPx(24), 0, dpToPx(12));
            container.addView(num);
        }
    }
}
